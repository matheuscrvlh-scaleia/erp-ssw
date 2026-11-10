/** Download, nome do arquivo e carimbo de geração, comuns a todos os formatos. */
import { formatarDataHora } from "@erp/shared/formatacao";

import { isoDoCalendario } from "@/lib/dia-do-calendario";

export function baixarArquivo(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/** Sufixo de data do nome do arquivo: dd-mm-aaaa (dia local de quem exporta). */
export function sufixoHoje(agora: Date = new Date()): string {
  const [ano, mes, dia] = isoDoCalendario(agora).split("-");
  return `${dia ?? ""}-${mes ?? ""}-${ano ?? ""}`;
}

const TERMINA_COM_DATA = /-\d{2}-\d{2}-\d{4}$/;

/**
 * Nome final: `<base>-dd-mm-aaaa.<ext>` (padrão de todas as exportações). Se a base já trouxer
 * o sufixo de data ou a extensão, eles não se repetem.
 */
export function nomeDoArquivo(base: string, extensao: string, agora: Date = new Date()): string {
  const semExtensao = base.trim().replace(new RegExp(`\\.${extensao}$`, "i"), "");
  const comData = TERMINA_COM_DATA.test(semExtensao)
    ? semExtensao
    : `${semExtensao}-${sufixoHoje(agora)}`;
  return `${comData}.${extensao}`;
}

/** "Gerado em dd/mm/aaaa hh:mm" no fuso da empresa. */
export function dataHoraGeracao(fuso: string, agora: Date = new Date()): string {
  return formatarDataHora(agora.toISOString(), fuso);
}
