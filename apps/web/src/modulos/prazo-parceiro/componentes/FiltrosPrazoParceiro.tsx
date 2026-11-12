import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosPrazoParceiro } from "@erp/shared/contratos/prazo-parceiro";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";

import { type BuscaPrazo } from "../busca";
import { opcoesDeTipo, ROTULO_PERIODO, rotuloDoTipo } from "../textos";
import { AlternadorDePeriodo } from "./AlternadorDePeriodo";

type Opcoes = SaidaDe<typeof contratosPrazoParceiro.opcoes>;

/** Filtros da visão geral (período, unidades, parceiros, tipo) e as etiquetas do que está ativo. */
export function FiltrosPrazoParceiro({
  busca: b,
  opcoes,
  mudar,
}: {
  busca: BuscaPrazo;
  opcoes: Opcoes | undefined;
  mudar: (m: Partial<BuscaPrazo>) => void;
}) {
  /** Nomes dos marcados; enquanto as opções não chegam, só a contagem (nunca o id). */
  const nomes = (
    ids: readonly string[],
    lista: readonly { id: string; nome: string }[] | undefined,
  ) => {
    const achados = ids.flatMap((id) => lista?.find((o) => o.id === id)?.nome ?? []);
    return achados.length === ids.length ? resumirNomes(achados) : null;
  };
  const etiquetas: EtiquetaFiltroOpcional[] = [
    b.unidades.length > 0 && {
      rotulo: "Unidades",
      ...(nomes(b.unidades, opcoes?.unidades) ?? {
        valor: b.unidades.length === 1 ? "1 selecionada" : `${b.unidades.length} selecionadas`,
      }),
      limpar: () => {
        mudar({ unidades: [] });
      },
    },
    b.parceiros.length > 0 && {
      rotulo: "Parceiros",
      ...(nomes(b.parceiros, opcoes?.parceiros) ?? {
        valor: b.parceiros.length === 1 ? "1 selecionado" : `${b.parceiros.length} selecionados`,
      }),
      limpar: () => {
        mudar({ parceiros: [] });
      },
    },
    b.tipos.length > 0 && {
      rotulo: "Tipo documento",
      ...resumirNomes(b.tipos.map(rotuloDoTipo)),
      limpar: () => {
        mudar({ tipos: [] });
      },
    },
  ];

  return (
    <>
      <FiltrosAvancados
        ativos={b.unidades.length > 0 || b.parceiros.length > 0 || b.tipos.length > 0}
        aoLimpar={() => {
          mudar({ unidades: [], parceiros: [], tipos: [] });
        }}
      >
        <AlternadorDePeriodo
          atual={b.periodo}
          aoMudar={(periodo) => {
            mudar({ periodo });
          }}
        />
        <FiltroMultiplo
          rotulo="Unidades"
          opcoes={opcoes?.unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))}
          selecionados={b.unidades}
          aoMudar={(unidades) => {
            mudar({ unidades });
          }}
          textoVazio="todos"
        />
        <FiltroMultiplo
          rotulo="Parceiros"
          opcoes={opcoes?.parceiros.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          selecionados={b.parceiros}
          aoMudar={(parceiros) => {
            mudar({ parceiros });
          }}
          textoVazio="todos"
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={opcoes && opcoesDeTipo(opcoes.tipos)}
          selecionados={b.tipos}
          aoMudar={(tipos) => {
            mudar({ tipos });
          }}
          textoVazio="todos"
        />
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {ROTULO_PERIODO[b.periodo]}
        </span>
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
