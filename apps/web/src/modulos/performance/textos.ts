import { type Status } from "@erp/dominio/performance/tela";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";

/** Cor de cada status (bom, alerta, ruim) nas barras da Performance. */
export const corDoStatus: Record<Status, string> = {
  bom: "var(--status-good)",
  alerta: "var(--status-warn)",
  ruim: "var(--status-bad)",
};

/** Data ISO (AAAA-MM-DD) como DD/MM/AAAA, no relatório de período. */
export const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Filtros herdados da tela, por extenso, para as etiquetas do relatório, o CSV, a impressão e as
 * notas da aba "Resumo". Unidade ou parceiro sem nome conhecido fica de fora, como hoje.
 */
export interface FiltrosDoRelatorio {
  unidades: readonly string[];
  parceiros: readonly string[];
  remetente: string;
  destino: string;
  filiais: readonly string[];
  codigos: readonly string[];
}

const ateTres = (lista: readonly string[]) =>
  lista.slice(0, 3).join(", ") + (lista.length > 3 ? ` +${String(lista.length - 3)}` : "");

/**
 * Etiquetas "Filtros herdados da barra principal" do relatório (e do CSV e da impressão).
 * origem: buildChips (RelatorioPeriodoPanel.tsx, sistema atual)
 */
export function etiquetasDoRelatorio(f: FiltrosDoRelatorio): { rotulo: string; valor: string }[] {
  const etiquetas: { rotulo: string; valor: string }[] = [];
  if (f.unidades.length > 0) etiquetas.push({ rotulo: "Unidades", valor: ateTres(f.unidades) });
  if (f.parceiros.length > 0) etiquetas.push({ rotulo: "Parceiros", valor: ateTres(f.parceiros) });
  if (f.remetente)
    etiquetas.push({ rotulo: "Remetente", valor: lerFiltroTexto(f.remetente).join(" · ") });
  if (f.destino)
    etiquetas.push({ rotulo: "Destino", valor: lerFiltroTexto(f.destino).join(" · ") });
  if (f.filiais.length > 0) etiquetas.push({ rotulo: "Filiais", valor: f.filiais.join(", ") });
  if (f.codigos.length > 0) etiquetas.push({ rotulo: "Ocorrências", valor: ateTres(f.codigos) });
  return etiquetas;
}
