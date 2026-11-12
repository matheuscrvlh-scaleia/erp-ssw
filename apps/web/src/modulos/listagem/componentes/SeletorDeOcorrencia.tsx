import { type FiltroListaEntrada } from "@erp/shared/contratos/listagem";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { GatilhoFiltro } from "@/componentes/comum/GatilhoFiltro";
import { Badge } from "@/componentes/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";
import { AvisoDaLista, ItemMarcavel } from "@/modulos/filtros/componentes";

import { consultaCodigosDoRecorte } from "../api";
import { codigosDoGrupo, type GrupoDeOcorrencia, GRUPOS_DE_OCORRENCIA } from "../regras";

const ROTULO_DO_GRUPO: Record<GrupoDeOcorrencia, string> = {
  aberto: "Em aberto",
  cliente: "Pendência do cliente",
  empresa: "Pendência da FR",
  penaliza: "Penalizam",
};

const TIPO_CURTO: Record<string, string> = {
  PENDENCIA_CLIENTE: "cliente",
  PENDENCIA_TRANSPORTADORA: "FR",
  INFORMATIVA: "info",
  BAIXA: "baixa",
  ENTREGA: "entrega",
};

/**
 * Seletor "Ocorrência": códigos de ocorrência efetiva do recorte atual, com a quantidade de
 * CT-e, busca e atalhos por grupo. Só consulta com o seletor aberto.
 * origem: OcorrenciaRecortePicker.tsx (sistema atual)
 */
export function SeletorDeOcorrencia({
  filtro,
  selecionados: marcados,
  aoMudar,
  nomeCurto,
}: {
  /** O filtro da lista; os códigos marcados não entram na contagem. */
  filtro: FiltroListaEntrada;
  selecionados: readonly number[];
  aoMudar: (codigos: number[]) => void;
  nomeCurto: string;
}) {
  // "FR" nos rótulos = a transportadora: vira o nome curto da empresa ativa.
  const comEmpresa = (t: string) => t.replace(/\bFR\b/, nomeCurto);
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const { selecionados, alterar, aplicar } = useSelecaoAdiada(marcados, aoMudar);
  const opcoes = useQuery({ ...consultaCodigosDoRecorte(filtro), enabled: aberto });

  const todos = useMemo(() => {
    const lista = [...(opcoes.data ?? [])].sort((a, b) => b.qtd - a.qtd);
    // Código marcado sem CT-e no recorte continua visível, para poder desmarcar.
    for (const codigo of selecionados) {
      if (!lista.some((c) => c.codigo === codigo)) {
        lista.push({ codigo, descricao: null, qtd: 0, tipo: null, penaliza: false });
      }
    }
    return lista;
  }, [opcoes.data, selecionados]);

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return todos;
    return todos.filter(
      (o) => String(o.codigo).includes(t) || (o.descricao ?? "").toLowerCase().includes(t),
    );
  }, [todos, termo]);

  const definir = (codigos: readonly number[]) => {
    alterar(
      [...codigos].sort((a, b) => a - b),
      true,
    );
  };
  const alternar = (codigo: number) => {
    alterar(
      selecionados.includes(codigo)
        ? selecionados.filter((c) => c !== codigo)
        : [...selecionados, codigo].sort((a, b) => a - b),
    );
  };
  const comCte = todos.filter((c) => c.qtd > 0);
  const [primeiro] = selecionados;

  return (
    <Popover
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) aplicar();
      }}
    >
      <PopoverTrigger asChild>
        <GatilhoFiltro
          ativo={selecionados.length > 0}
          rotulo="Ocorrência"
          aoLimpar={() => {
            definir([]);
          }}
          title="Filtrar pela ocorrência atual (efetiva) do CT-e"
        >
          Ocorrência{" "}
          {selecionados.length > 0 ? (
            <Badge
              variant="secondary"
              className="h-5 border-transparent bg-brand-suave px-2 text-[11.5px] text-brand"
            >
              {selecionados.length === 1 ? `#${primeiro ?? ""}` : `${selecionados.length} códigos`}
            </Badge>
          ) : (
            <span className="text-muted-foreground">qualquer</span>
          )}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-0" align="start">
        <div className="space-y-2 border-b border-border p-2">
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
            }}
            placeholder="Buscar por código ou descrição…"
            aria-label="Buscar ocorrência"
            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] outline-none focus:border-ring"
          />
          <div className="flex flex-wrap items-center gap-1">
            {GRUPOS_DE_OCORRENCIA.map((g) => {
              const codigos = codigosDoGrupo(g, comCte, filtro.tipo ?? "emitidos");
              const ativo =
                codigos.length > 0 &&
                codigos.length === selecionados.length &&
                codigos.every((c) => selecionados.includes(c));
              const rotulo = comEmpresa(ROTULO_DO_GRUPO[g]);
              return (
                <button
                  key={g}
                  type="button"
                  disabled={codigos.length === 0}
                  onClick={() => {
                    definir(ativo ? [] : codigos);
                  }}
                  className={cn(
                    "h-7 rounded-full border border-border px-2.5 text-[12px] font-medium hover:bg-muted disabled:opacity-40",
                    ativo &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  title={`Mostrar só os códigos de "${rotulo.toLowerCase()}" deste recorte`}
                >
                  {rotulo}
                </button>
              );
            })}
            <span className="ml-auto flex gap-2 text-[12px] font-medium text-brand">
              <button
                type="button"
                className="hover:underline disabled:opacity-40"
                disabled={comCte.length === 0}
                onClick={() => {
                  definir(comCte.map((c) => c.codigo));
                }}
              >
                todas
              </button>
              <button
                type="button"
                className="hover:underline disabled:opacity-40"
                disabled={selecionados.length === 0}
                onClick={() => {
                  definir([]);
                }}
              >
                limpar
              </button>
            </span>
          </div>
        </div>
        <ul className="rolagem-fina max-h-80 overflow-auto p-1">
          {opcoes.isLoading && <AvisoDaLista>Carregando ocorrências do recorte…</AvisoDaLista>}
          {opcoes.isError && (
            <AvisoDaLista erro>
              {mensagemAmigavel(
                opcoes.error,
                "Não foi possível carregar as ocorrências. Tente de novo.",
              )}
            </AvisoDaLista>
          )}
          {visiveis.map((o) => {
            const tipo = o.tipo ? TIPO_CURTO[o.tipo] : undefined;
            return (
              <ItemMarcavel
                key={o.codigo}
                marcado={selecionados.includes(o.codigo)}
                aoAlternar={() => {
                  alternar(o.codigo);
                }}
              >
                <span className="font-mono text-xs text-muted-foreground">#{o.codigo}</span>
                <span className="flex-1 truncate">{o.descricao ?? "sem CT-e no recorte"}</span>
                {tipo && <span className="label-xs shrink-0">{comEmpresa(tipo)}</span>}
                <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                  {o.qtd.toLocaleString("pt-BR")}
                </span>
              </ItemMarcavel>
            );
          })}
          {!opcoes.isLoading && !opcoes.isError && visiveis.length === 0 && (
            <AvisoDaLista>Nenhuma ocorrência no recorte.</AvisoDaLista>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
