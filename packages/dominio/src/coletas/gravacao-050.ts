import { type EtapaDeColeta } from "@erp/shared/contratos/coletas";

import { etapaDaSituacao } from "./coletas";
import { type Coleta050, type Relatorio050 } from "./leitor-050";

/** O que já está gravado de uma coleta e pesa na nova gravação. */
export interface ColetaJaGravada {
  unidade: string;
  numero: number;
  relatorioEmitidoEm: Date;
  prejudicadaHorario: boolean;
  cteSigla: string | null;
  cteNumero: string | null;
  romaneio: string | null;
}

export interface ColetaParaGravar extends Coleta050 {
  etapa: EtapaDeColeta;
  relatorioEmitidoEm: Date;
  arquivoOrigem: string;
}

export const chaveDaColeta = (c: { unidade: string; numero: number }) => `${c.unidade}|${c.numero}`;

/**
 * Decide o que gravar de um 050:
 * - coleta repetida no arquivo: vale a última linha (Q24 do dono);
 * - coleta já gravada a partir de um 050 mais novo fica como está (empate de emissão regrava);
 * - "prejudicada pelo horário" gruda em verdadeiro; CT-e gerado e romaneio não somem;
 * - o histórico é substituído; nada é apagado (coleta que some do relatório fica como estava).
 * origem: importar_coletas_050 (sistema atual)
 */
export function planejarGravacao050(
  relatorio: Relatorio050,
  arquivoOrigem: string,
  jaGravadas: ReadonlyMap<string, ColetaJaGravada>,
): { gravar: ColetaParaGravar[]; lidas: number; ignoradas: number } {
  const emitidoEm = new Date(relatorio.emitidoEm);
  const ultimas = new Map(relatorio.coletas.map((c) => [chaveDaColeta(c), c]));
  const gravar = [...ultimas.values()].flatMap((c): ColetaParaGravar[] => {
    const atual = jaGravadas.get(chaveDaColeta(c));
    if (atual && atual.relatorioEmitidoEm > emitidoEm) return [];
    return [
      {
        ...c,
        etapa: etapaDaSituacao(c.situacao),
        prejudicadaHorario: c.prejudicadaHorario || (atual?.prejudicadaHorario ?? false),
        cteSigla: c.cteSigla ?? atual?.cteSigla ?? null,
        cteNumero: c.cteNumero ?? atual?.cteNumero ?? null,
        romaneio: c.romaneio ?? atual?.romaneio ?? null,
        relatorioEmitidoEm: emitidoEm,
        arquivoOrigem,
      },
    ];
  });
  const lidas = relatorio.coletas.length;
  return { gravar, lidas, ignoradas: lidas - gravar.length };
}
