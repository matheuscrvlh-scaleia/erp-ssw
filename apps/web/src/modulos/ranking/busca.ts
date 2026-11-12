import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { useState } from "react";

import { type EtiquetaFiltroOpcional, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { type Periodo } from "@/componentes/comum/periodo";
import { unirParceiros } from "@/lib/opcoes-de-filtro";

export type Base = "emissao" | "prevista";

const PERIODO_PADRAO: Periodo = "30d";
const BASE_PADRAO: Base = "emissao";

/**
 * Filtros do ranking, guardados na página: valem para as duas abas (Parceiro e Cidade), que
 * leem a mesma barra de filtros no topo.
 */
export function useFiltrosDoRanking() {
  const [rapido, setRapido] = useState<Periodo>(PERIODO_PADRAO);
  const [base, setBase] = useState<Base>(BASE_PADRAO);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [filiais, setFiliais] = useState<string[]>([]);
  // Dois seletores de parceiro: por CNPJ e agrupado pelo nome (matriz e filiais juntas). A tela
  // filtra pela união dos CNPJs marcados nos dois.
  const [parceirosCnpj, setParceirosCnpj] = useState<string[]>([]);
  const [parceirosAgrupados, setParceirosAgrupados] = useState<string[]>([]);
  const [destino, setDestino] = useState("");
  const [remetente, setRemetente] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);

  const ativos =
    rapido !== PERIODO_PADRAO ||
    base !== BASE_PADRAO ||
    filiais.length > 0 ||
    parceirosCnpj.length > 0 ||
    parceirosAgrupados.length > 0 ||
    destino.trim() !== "" ||
    remetente.trim() !== "" ||
    tipos.length > 0;

  const limpar = () => {
    setRapido(PERIODO_PADRAO);
    setBase(BASE_PADRAO);
    setDe("");
    setAte("");
    setFiliais([]);
    setParceirosCnpj([]);
    setParceirosAgrupados([]);
    setDestino("");
    setRemetente("");
    setTipos([]);
  };

  return {
    rapido,
    base,
    de,
    ate,
    filiais,
    parceirosCnpj,
    parceirosAgrupados,
    parceiros: unirParceiros(parceirosCnpj, parceirosAgrupados),
    destino,
    remetente,
    tipos,
    ativos,
    mudarPeriodo: (m: { periodo: Periodo; de: string; ate: string }) => {
      setRapido(m.periodo);
      setDe(m.de);
      setAte(m.ate);
    },
    setBase,
    setFiliais,
    setParceirosCnpj,
    setParceirosAgrupados,
    setDestino,
    setRemetente,
    setTipos,
    limpar,
  };
}

export type FiltrosDoRanking = ReturnType<typeof useFiltrosDoRanking>;

/**
 * Etiquetas do "Filtrando por"; cada uma limpa o seu filtro. Os nomes dos parceiros vêm prontos
 * (nos dois seletores, CNPJs de mesmo nome contam como um parceiro, como hoje).
 */
export function etiquetasDosFiltros(
  f: FiltrosDoRanking,
  nomes: { parceiros: readonly string[]; agrupados: readonly string[]; tipos: string },
): EtiquetaFiltroOpcional[] {
  const { parceiros: nomesParceiros, agrupados: nomesAgrupados, tipos: rotuloTipos } = nomes;
  const { filiais, destino, remetente, tipos } = f;
  return [
    nomesParceiros.length > 0 && {
      rotulo: nomesParceiros.length === 1 ? "Parceiro" : "Parceiros",
      ...resumirNomes(nomesParceiros),
      limpar: () => {
        f.setParceirosCnpj([]);
      },
    },
    nomesAgrupados.length > 0 && {
      rotulo: nomesAgrupados.length === 1 ? "Parceiro agrupado" : "Parceiros agrupados",
      ...resumirNomes(nomesAgrupados),
      limpar: () => {
        f.setParceirosAgrupados([]);
      },
    },
    remetente.trim() !== "" && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(remetente)),
      limpar: () => {
        f.setRemetente("");
      },
    },
    destino.trim() !== "" && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(destino)),
      limpar: () => {
        f.setDestino("");
      },
    },
    filiais.length > 0 && {
      rotulo: "Unidade responsável",
      valor: filiais.join(", "),
      limpar: () => {
        f.setFiliais([]);
      },
    },
    tipos.length > 0 && {
      rotulo: "Tipo",
      valor: rotuloTipos,
      limpar: () => {
        f.setTipos([]);
      },
    },
  ];
}
