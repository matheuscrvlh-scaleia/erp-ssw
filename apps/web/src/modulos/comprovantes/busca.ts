import {
  type FiltrosDeComprovantes,
  STATUS_DE_COMPROVANTE,
} from "@erp/shared/contratos/comprovantes";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { z } from "@erp/shared/zod";

import { type EtiquetaFiltro, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { type Intervalo } from "@/componentes/comum/periodo";
import { campoFiltro } from "@/hooks/use-filtros-na-url";

/** Parâmetros da URL de /comprovantes — os mesmos do sistema atual. */
export const esquemaDaBusca = z.object({
  periodo: campoFiltro.opcao(["hoje", "7d", "30d", "mes", "mes_anterior", "custom"], "mes"),
  de: campoFiltro.data(),
  ate: campoFiltro.data(),
  unidades: campoFiltro.lista(),
  filiais: campoFiltro.lista(),
  pagadores: campoFiltro.lista(),
  status: campoFiltro.opcao(STATUS_DE_COMPROVANTE, "todos"),
  ctrc: campoFiltro.texto(60),
  nf: campoFiltro.texto(60),
  tipos: campoFiltro.lista(),
  remetente: campoFiltro.texto(),
  destino: campoFiltro.texto(),
  page: campoFiltro.pagina(),
  size: z.coerce.number().int().min(1).max(500).catch(50),
});
export type BuscaComprovantes = z.output<typeof esquemaDaBusca>;

export function filtrosDaBusca(b: BuscaComprovantes, periodo: Intervalo): FiltrosDeComprovantes {
  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
    unidades: b.unidades,
    filiais: b.filiais,
    pagadores: b.pagadores,
    ctrc: b.ctrc,
    nf: b.nf,
    tipos: b.tipos,
    remetente: b.remetente,
    destino: b.destino,
  };
}

/** O status do card só abre a lista lateral, não recorta a tela: não é filtro. */
const NAO_SAO_FILTRO = new Set(["status", "page", "size"]);

export function temFiltro(ativos: readonly string[], b: BuscaComprovantes): boolean {
  return ativos.some((c) => !NAO_SAO_FILTRO.has(c) && (c !== "periodo" || b.periodo === "custom"));
}

export type EtiquetaDaBusca = Omit<EtiquetaFiltro, "limpar"> & {
  limpar: Partial<BuscaComprovantes>;
};

/**
 * Faixa "Filtrando por" (o período fica de fora: já está nos botões). Pagador pelo nome, quando
 * as opções já chegaram.
 */
export function etiquetasDaBusca(
  b: BuscaComprovantes,
  nomesDosPagadores: readonly string[] = b.pagadores,
): EtiquetaDaBusca[] {
  const lista = (rotulo: string, valores: readonly string[], limpar: Partial<BuscaComprovantes>) =>
    valores.length > 0 ? [{ rotulo, ...resumirNomes(valores), limpar }] : [];
  const texto = (rotulo: string, valor: string, limpar: Partial<BuscaComprovantes>) =>
    valor.trim() ? [{ rotulo, valor: valor.trim(), limpar }] : [];
  return [
    ...lista("Unidade responsável", b.filiais, { filiais: [] }),
    ...(b.unidades.length > 0
      ? [
          {
            rotulo: "Unidades",
            valor:
              b.unidades.length === 1
                ? "1 selecionada"
                : `${String(b.unidades.length)} selecionadas`,
            limpar: { unidades: [] },
          },
        ]
      : []),
    ...lista("Pagador", nomesDosPagadores, { pagadores: [] }),
    ...lista(
      "Tipo documento",
      b.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t)),
      { tipos: [] },
    ),
    ...lista("Remetente", lerFiltroTexto(b.remetente), { remetente: "" }),
    ...lista("Destino", lerFiltroTexto(b.destino), { destino: "" }),
    ...texto("CTRC", b.ctrc, { ctrc: "" }),
    ...texto("Nota fiscal", b.nf, { nf: "" }),
  ];
}
