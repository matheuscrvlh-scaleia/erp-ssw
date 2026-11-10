/**
 * Seletores de filtro ligados às consultas compartilhadas (unidades, parceiros, sugestões), sobre
 * o kit (`FiltroMultiplo`, `FiltroTexto`), e as peças que o kit não tem (busca por documento,
 * dica, item marcável dos seletores próprios).
 * origem: FiltrosAvancados.tsx, PagadorPicker.tsx, BuscaDocumentoInput.tsx (sistema atual)
 */
import { ordenarTiposDocumento } from "@erp/dominio/performance/tela";
import { type EntradaDe } from "@erp/shared/contrato";
import {
  contratosFiltros as c,
  type PagadorOpcao,
  SEM_TIPO_DOCUMENTO,
  type TipoDocumentoOpcao,
} from "@erp/shared/contratos/filtros";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { chamar } from "@/lib/api";
import { cn } from "@/lib/utils";
import { inteiro } from "@/modulos/compartilhado/formatos";

import {
  consultaFiliaisProprias,
  consultaOpcoesDeFiltro,
  consultaTiposDocumento,
  consultaTiposNoPeriodo,
  type EscopoDoTipoDocumento,
} from "./api";
import { siglasDoSeletor } from "./regras";

export type ContextoDosFiltros = EntradaDe<typeof c.opcoes>;

/** Item de seletor próprio (Recorte, Ocorrência), no mesmo desenho do `FiltroMultiplo`. */
export function ItemMarcavel({
  marcado,
  aoAlternar,
  children,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={marcado}
        onClick={aoAlternar}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted",
          marcado && "bg-status-good-bg",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border",
            marcado && "border-brand bg-brand text-white",
          )}
        >
          {marcado && <Check className="h-2.5 w-2.5" />}
        </span>
        {children}
      </button>
    </li>
  );
}

export function AvisoDaLista({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <li
      className={cn(
        "px-3 py-3 text-center text-[11px] text-muted-foreground",
        erro && "text-status-bad",
      )}
    >
      {children}
    </li>
  );
}

/**
 * Busca por NF ou CT-e com espera de 400 ms (Enter aplica na hora). Aceita o número com ou sem
 * série e com ou sem dígito ("020642", "CAP020642-3").
 */
export function BuscaDocumento({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [local, setLocal] = useState(valor);
  const [valorVisto, setValorVisto] = useState(valor);
  if (valorVisto !== valor) {
    setValorVisto(valor);
    setLocal(valor);
  }

  useEffect(() => {
    const relogio = setTimeout(() => {
      if (local.trim() !== valor.trim()) aoMudar(local.trim());
    }, 400);
    return () => {
      clearTimeout(relogio);
    };
  }, [local, valor, aoMudar]);

  return (
    <div className={cn("relative w-[190px]", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") aoMudar(local.trim());
        }}
        placeholder={placeholder}
        aria-label={`Buscar por ${placeholder.replace(/\.+$/, "")}`}
        className="h-[26px] w-full rounded-md border border-border/70 bg-background pr-6 pl-7 text-[12px] outline-none focus:border-brand"
      />
      {local.length > 0 && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setLocal("");
            aoMudar("");
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** "Unidade responsável": unidades do período, consultadas só com o seletor aberto. */
export function SeletorDeFilial({
  selecionadas,
  aoMudar,
  contexto,
}: {
  selecionadas: readonly string[];
  aoMudar: (siglas: string[]) => void;
  contexto: ContextoDosFiltros;
}) {
  const [aberto, setAberto] = useState(false);
  const opcoes = useQuery({
    ...consultaOpcoesDeFiltro({ ...contexto, filiais: undefined }),
    enabled: aberto,
  });
  const proprias = useQuery({ ...consultaFiliaisProprias, enabled: aberto });
  const siglas = opcoes.data
    ? siglasDoSeletor(opcoes.data.filiais, selecionadas, proprias.data ?? [])
    : undefined;
  return (
    <span className="inline-flex items-center gap-1">
      <FiltroMultiplo
        rotulo="Unidade responsável"
        opcoes={siglas?.map((s) => ({ valor: s }))}
        selecionados={selecionadas}
        aoMudar={aoMudar}
        aoAbrir={setAberto}
        resumo={(s) => String(s.length)}
        larguraClasse="w-48"
        monoespacado
      />
      <InfoTip texto="Unidade responsável pelo CT-e: usa a unidade de destino; na falta dela, a unidade atual; e por último a filial emissora." />
    </span>
  );
}

/** Parceiros (pagadores do período), com busca por nome ou CNPJ. */
export function SeletorDePagador({
  rotulo,
  opcoes,
  selecionados,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly PagadorOpcao[] | undefined;
  selecionados: readonly string[];
  aoMudar: (ids: string[]) => void;
}) {
  return (
    <FiltroMultiplo
      rotulo={rotulo}
      textoVazio="todos"
      opcoes={opcoes?.map((o) => ({
        valor: o.id,
        rotulo: `${o.nome} · ${o.cnpjFormatado}`,
      }))}
      selecionados={selecionados}
      aoMudar={aoMudar}
      resumo={(s) => String(s.length)}
      busca
      larguraClasse="w-80"
    />
  );
}

/** Remetente / Destino ("a|b"), com as sugestões do período. */
export function SeletorDeTexto({
  rotulo,
  campo,
  valor,
  aoMudar,
  contexto,
}: {
  rotulo: string;
  campo: "remetente" | "cidade_destino";
  valor: string;
  aoMudar: (valor: string) => void;
  contexto: ContextoDosFiltros;
}) {
  return (
    <FiltroTexto
      rotulo={rotulo}
      valor={valor}
      aoMudar={aoMudar}
      sugestoes={{
        chave: ["filtros", "sugestoes", campo, contexto],
        buscar: (q) => chamar(c.sugestoes, { entrada: { ...contexto, campo, q } }),
      }}
    />
  );
}

/**
 * "Tipo documento": os tipos da base inteira, com quantos CT-e de cada há no período da tela; os
 * sem CT-e no período ficam apagados, no fim. As duas listas só são buscadas com o seletor aberto.
 * origem: TipoDocumentoPicker (FiltrosAvancados.tsx, sistema atual)
 */
export function SeletorDeTipoDocumento({
  selecionados,
  aoMudar,
  escopo,
  contagens,
  aoAbrir,
}: {
  selecionados: readonly string[];
  aoMudar: (tipos: string[]) => void;
  /** Período e base de data da tela: a contagem vem do filtro compartilhado. */
  escopo?: EscopoDoTipoDocumento | undefined;
  /** Contagem já calculada pela tela, com os filtros dela; dispensa `escopo`. */
  contagens?: readonly TipoDocumentoOpcao[] | undefined;
  /** Avisa abrir/fechar (a tela que passa `contagens` pode buscá-las só aberto). */
  aoAbrir?: ((aberto: boolean) => void) | undefined;
}) {
  const [aberto, setAberto] = useState(false);
  const tipos = useQuery({ ...consultaTiposDocumento, enabled: aberto });
  const noPeriodo = useQuery({
    ...consultaTiposNoPeriodo(escopo),
    enabled: aberto && escopo !== undefined && contagens === undefined,
  });
  // Enquanto a contagem não chega (ou se não deu para contar), nenhum tipo fica apagado.
  const contagem = contagens ?? noPeriodo.data ?? undefined;
  return (
    <FiltroMultiplo
      rotulo="Tipo documento"
      textoVazio="todos"
      opcoes={
        tipos.data
          ? ordenarTiposDocumento(tipos.data, contagem).map((t) => ({
              valor: t.tipo,
              rotulo: t.tipo === SEM_TIPO_DOCUMENTO ? "Sem tipo" : t.tipo,
              detalhe: contagem && t.qtd > 0 ? inteiro(t.qtd) : undefined,
              apagada: contagem !== undefined && t.qtd === 0,
            }))
          : undefined
      }
      aoAbrir={(a) => {
        setAberto(a);
        aoAbrir?.(a);
      }}
      selecionados={selecionados}
      aoMudar={aoMudar}
    />
  );
}
