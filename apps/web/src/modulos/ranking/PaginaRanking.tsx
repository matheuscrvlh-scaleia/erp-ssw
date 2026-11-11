import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";

import { useFiltrosDoRanking } from "./filtros-do-ranking";
import { RankingDoGrupo } from "./RankingDoGrupo";

type Grupo = "pagador" | "cidade";

/** origem: routes/_authenticated/ranking.tsx (sistema atual) */
export function PaginaRanking() {
  const [grupo, setGrupo] = useState<Grupo>("pagador");
  const filtros = useFiltrosDoRanking();
  return (
    // key: cada aba começa com a própria ordenação, filtro dos cards e ano do gráfico.
    <RankingDoGrupo
      key={grupo}
      grupo={grupo}
      filtros={filtros}
      abas={
        <Abas
          rotulo="Abas do ranking"
          abas={[
            { valor: "pagador", rotulo: "Parceiro" },
            { valor: "cidade", rotulo: "Cidade" },
          ]}
          valor={grupo}
          aoMudar={setGrupo}
        />
      }
    />
  );
}
