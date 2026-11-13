import { SEM_TIPO } from "@erp/domain/manifest/today";
import { hojeNoFuso } from "@erp/shared/dates";
import { useQuery } from "@tanstack/react-query";

import { FiltrandoPor, FiltrosAvancados, resumirNomes } from "@/components/common/AdvancedFilters";
import { FiltroMultiplo } from "@/components/common/MultiFilter";

import { consultaHoje, consultaOpcoes } from "../api";
import { entradaDaHoje, FILTROS_DA_HOJE_VAZIOS, type FiltrosHoje } from "../rules";

/** Filtros da aba Hoje (slot `filtros` da página): unidade e tipo de documento do dia. */
export function FiltrosDaHoje({
  fuso,
  filtros,
  aoMudar,
}: {
  fuso: string;
  filtros: FiltrosHoje;
  aoMudar: (filtros: FiltrosHoje) => void;
}) {
  const d = useQuery(consultaHoje(entradaDaHoje(filtros))).data;
  const dia = d?.dia ?? hojeNoFuso(fuso);
  const opcoes = useQuery(consultaOpcoes({ campo: "emissao", inicio: dia, fim: dia }));
  const { filiais, tipos } = filtros;
  return (
    <>
      <FiltrosAvancados
        ativos={filiais.length > 0 || tipos.length > 0}
        aoLimpar={() => {
          aoMudar(FILTROS_DA_HOJE_VAZIOS);
        }}
      >
        <FiltroMultiplo
          rotulo="Unidade responsável"
          opcoes={opcoes.data?.filiais.map((f) => ({ valor: f.sigla, detalhe: f.nome }))}
          selecionados={filiais}
          aoMudar={(v) => {
            aoMudar({ ...filtros, filiais: v });
          }}
          monoespacado
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={[
            ...(d?.tipos ?? []).map((t) => ({ valor: t })),
            { valor: SEM_TIPO, rotulo: "sem tipo" },
          ]}
          selecionados={tipos}
          aoMudar={(v) => {
            aoMudar({ ...filtros, tipos: v });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor
        etiquetas={[
          filiais.length > 0 && {
            rotulo: "Unidade responsável",
            ...resumirNomes(filiais),
            limpar: () => {
              aoMudar({ ...filtros, filiais: [] });
            },
          },
          tipos.length > 0 && {
            rotulo: "Tipo documento",
            ...resumirNomes(tipos.map((t) => (t === SEM_TIPO ? "sem tipo" : t))),
            limpar: () => {
              aoMudar({ ...filtros, tipos: [] });
            },
          },
        ]}
      />
    </>
  );
}
