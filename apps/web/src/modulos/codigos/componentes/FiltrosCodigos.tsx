import {
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contratos/codigos-ocorrencia";

import { Alternador } from "@/componentes/comum/Alternador";
import { BuscaNaBarra, Escolha } from "@/componentes/comum/CamposDeFormulario";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";

import { ehLetra, FILTROS_INICIAIS, type FiltrosDosCodigos, ORDENS } from "../regras";

const ROTULO_DA_ORDEM = {
  codigo: "Ordenar: código",
  freq: "Ordenar: frequência (30d)",
  atualizado: "Ordenar: última edição",
} as const;

const OPCOES_DE_PENALIZA = [
  { valor: "tudo", rotulo: "Todos" },
  { valor: "sim", rotulo: "Só penalizantes" },
  { valor: "nao", rotulo: "Só não-penalizantes" },
];

const OPCOES_DE_SITUACAO = [
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "inativo", rotulo: "Inativos" },
  { valor: "tudo", rotulo: "Todos" },
] as const;

/** Situação, letra, penaliza, ordem e busca do catálogo de códigos. */
export function FiltrosCodigos({
  filtros,
  rotulos,
  aoMudar,
  aoLimpar,
}: {
  filtros: FiltrosDosCodigos;
  rotulos: Record<LetraDeResponsavel, string>;
  aoMudar: (m: Partial<FiltrosDosCodigos>) => void;
  aoLimpar: () => void;
}) {
  const filtrosMexidos =
    filtros.busca !== FILTROS_INICIAIS.busca ||
    filtros.letras.length > 0 ||
    filtros.penaliza !== FILTROS_INICIAIS.penaliza ||
    filtros.ativo !== FILTROS_INICIAIS.ativo ||
    filtros.ordem !== FILTROS_INICIAIS.ordem;
  return (
    <FiltrosAvancados ativos={filtrosMexidos} aoLimpar={aoLimpar}>
      <Alternador
        rotulo="Situação"
        opcoes={OPCOES_DE_SITUACAO}
        valor={filtros.ativo}
        aoMudar={(ativo) => {
          aoMudar({ ativo });
        }}
      />
      <FiltroMultiplo
        rotulo="Letra"
        opcoes={LETRAS_DE_RESPONSAVEL.map((l) => ({
          valor: l,
          rotulo: `${l} — ${rotulos[l]}`,
        }))}
        selecionados={filtros.letras}
        aoMudar={(v) => {
          aoMudar({ letras: v.filter(ehLetra) });
        }}
        resumo={(v) => v.join(" · ")}
        busca={false}
      />
      <Escolha
        filtro
        rotulo="Penaliza"
        prefixo="Penaliza"
        opcoes={OPCOES_DE_PENALIZA}
        valor={filtros.penaliza}
        aoMudar={(v) => {
          aoMudar({ penaliza: v === "sim" || v === "nao" ? v : "tudo" });
        }}
      />
      <Escolha
        filtro
        rotulo="Ordem"
        opcoes={ORDENS.map((o) => ({ valor: o, rotulo: ROTULO_DA_ORDEM[o] }))}
        valor={filtros.ordem}
        aoMudar={(v) => {
          aoMudar({ ordem: ORDENS.find((o) => o === v) ?? "codigo" });
        }}
      />
      <BuscaNaBarra
        rotulo="Buscar código"
        placeholder="código ou descrição"
        valor={filtros.busca}
        aoMudar={(busca) => {
          aoMudar({ busca });
        }}
      />
    </FiltrosAvancados>
  );
}
