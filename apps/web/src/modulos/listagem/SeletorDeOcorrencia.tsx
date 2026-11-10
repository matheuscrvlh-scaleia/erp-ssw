import { codigoEmAbertoNoRecorte } from "@erp/dominio/listagem/faixas";
import {
  type CodigoDoRecorte,
  type FiltroListaEntrada,
  type TipoRecorte,
} from "@erp/shared/contratos/listagem";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useSelecaoAdiada } from "@/hooks/use-selecao-adiada";
import { cn } from "@/lib/utils";
import {
  AvisoDaLista,
  Contagem,
  GatilhoDeFiltro,
  ItemMarcavel,
  LimparNoGatilho,
} from "@/modulos/filtros/componentes";

import { consultaCodigosDoRecorte } from "./api";

export const GRUPOS_DE_OCORRENCIA = ["aberto", "cliente", "empresa", "penaliza"] as const;
export type GrupoDeOcorrencia = (typeof GRUPOS_DE_OCORRENCIA)[number];

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
 * Códigos do recorte (com CT-e) que formam o atalho. "Em aberto" de "Saíram para entrega com
 * prazo vencido" usa a lista de finalizadores própria.
 */
export function codigosDoGrupo(
  grupo: GrupoDeOcorrencia,
  codigos: readonly CodigoDoRecorte[],
  recorte: TipoRecorte,
): number[] {
  const entra = (c: CodigoDoRecorte) => {
    if (grupo === "aberto") return codigoEmAbertoNoRecorte(recorte, c);
    if (grupo === "cliente") return c.tipo === "PENDENCIA_CLIENTE";
    if (grupo === "empresa") return c.tipo === "PENDENCIA_TRANSPORTADORA";
    return c.penaliza;
  };
  return codigos
    .filter((c) => c.qtd > 0 && entra(c))
    .map((c) => c.codigo)
    .sort((a, b) => a - b);
}

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
        <GatilhoDeFiltro
          ativo={selecionados.length > 0}
          title="Filtrar pela ocorrência atual (efetiva) do CT-e"
        >
          Ocorrência
          {selecionados.length > 0 ? (
            <Contagem>
              {selecionados.length === 1 ? `#${primeiro ?? ""}` : `${selecionados.length} códigos`}
            </Contagem>
          ) : (
            <span className="text-muted-foreground">qualquer</span>
          )}
          {selecionados.length > 0 && (
            <LimparNoGatilho
              rotulo="Limpar ocorrências"
              aoLimpar={() => {
                definir([]);
              }}
            />
          )}
        </GatilhoDeFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-0" align="start">
        <div className="space-y-2 border-b border-border/60 p-2">
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
            }}
            placeholder="Buscar por código ou descrição…"
            className="w-full rounded-md border border-border/70 bg-background px-2 py-1 text-[12px] outline-none focus:border-brand"
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
                    "rounded-full border border-border/70 px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40",
                    ativo && "border-brand bg-brand text-white hover:bg-brand",
                  )}
                  title={`Mostrar só os códigos de "${rotulo.toLowerCase()}" deste recorte`}
                >
                  {rotulo}
                </button>
              );
            })}
            <span className="ml-auto flex gap-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="underline disabled:opacity-40"
                disabled={comCte.length === 0}
                onClick={() => {
                  definir(comCte.map((c) => c.codigo));
                }}
              >
                todas
              </button>
              <button
                type="button"
                className="underline disabled:opacity-40"
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
        <ul className="max-h-80 overflow-auto py-1">
          {opcoes.isLoading && <AvisoDaLista>Carregando ocorrências do recorte…</AvisoDaLista>}
          {opcoes.isError && (
            <AvisoDaLista erro>
              {opcoes.error.message || "Não foi possível carregar as ocorrências. Tente de novo."}
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
                <span className="font-mono text-[11px] text-muted-foreground">#{o.codigo}</span>
                <span className="flex-1 truncate">{o.descricao ?? "sem CT-e no recorte"}</span>
                {tipo && (
                  <span className="shrink-0 text-[9px] tracking-wide text-muted-foreground uppercase">
                    {comEmpresa(tipo)}
                  </span>
                )}
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
