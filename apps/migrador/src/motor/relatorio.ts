import { type Contagem } from "./estado";
import { type Relatorio, type RelatorioDaTabela } from "./executar";

const EXEMPLOS_NO_RESUMO = 20;

function listaDeContagens(titulo: string, contagens: Record<string, Contagem>): string[] {
  const entradas = Object.entries(contagens);
  if (entradas.length === 0) return [];
  return [
    `**${titulo}**`,
    "",
    ...entradas.map(([motivo, { quantidade, exemplos }]) => {
      const amostra = exemplos.slice(0, EXEMPLOS_NO_RESUMO).join(", ");
      const resto = quantidade > EXEMPLOS_NO_RESUMO ? " …" : "";
      return `- ${motivo}: ${String(quantidade)} (${amostra}${resto})`;
    }),
    "",
  ];
}

function secaoDaTabela(t: RelatorioDaTabela): string[] {
  const c = t.conferencia;
  const conferencia = c
    ? `${c.confere ? "confere" : "**NÃO CONFERE**"} — origem ${String(c.origem)} × destino ${String(c.destino)}; checksum ${c.checksumOrigem} × ${c.checksumDestino}${c.errosDeConversao > 0 ? `; ${String(c.errosDeConversao)} erros de conversão` : ""}`
    : "não conferida";
  const erros = t.estado.erros.map((e) => `- ${e.chave}: ${e.motivo} (valor \`${e.valor}\`)`);
  return [
    `### ${t.nome}`,
    "",
    `Origem \`${t.origem}\` → destino \`erp.${t.destino}\`. Situação: ${t.estado.status}${t.retomadaConcluida ? " (já concluída no checkpoint)" : ""}.`,
    "",
    `- Lidas: ${String(t.estado.lidas)}; migradas: ${String(t.estado.migradas)}`,
    `- Conferência: ${conferencia}`,
    ...t.notas.map((n) => `- ${n}`),
    "",
    ...listaDeContagens("Descartadas", t.estado.descartes),
    ...listaDeContagens("Ajustadas", t.estado.ajustes),
    ...(erros.length > 0 ? ["**Valores que não cabem no destino**", "", ...erros, ""] : []),
  ];
}

/** Relatório legível (markdown). A versão completa, com todas as chaves, vai no JSON. */
export function relatorioEmMarkdown(r: Relatorio, foraDoEscopo: readonly string[]): string {
  return [
    `# Migração public → erp${r.simulacao ? " (simulação)" : ""}`,
    "",
    `- Resultado: ${r.sucesso ? "sucesso" : "**com falhas**"}`,
    `- Início: ${r.iniciadoEm}; fim: ${r.finalizadoEm}`,
    `- Instante de referência (retenções e datas preenchidas): ${r.instante}`,
    `- Empresa: ${r.empresaId ?? "todas"}`,
    "",
    "## Tabelas",
    "",
    ...r.tabelas.flatMap(secaoDaTabela),
    "## Passos finais",
    "",
    ...r.passosFinais.flatMap((p) => [`### ${p.nome}`, "", ...p.notas.map((n) => `- ${n}`), ""]),
    "## Fora da migração (decisão do de-para)",
    "",
    ...foraDoEscopo.map((f) => `- ${f}`),
    "",
  ].join("\n");
}
