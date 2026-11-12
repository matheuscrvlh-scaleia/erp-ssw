import { type Tela } from "./telas";

/**
 * Catálogo de módulos (o que é vendido por empresa). É a fonte do seed da tabela `modulos`; a
 * liberação por empresa (com vigência) mora em `empresa_modulos`.
 * origem: migration multiempresa_f1_plano_de_controle (sistema atual)
 */
export const MODULOS = [
  {
    chave: "essencial",
    nome: "Essencial",
    descricao: "Usuários, cargos, departamentos, configurações e logs.",
    telas: [
      "admin_usuarios",
      "admin_roles",
      "admin_departamentos",
      "admin_configuracoes",
      "admin_logs",
    ],
    essencial: true,
    ordem: 0,
  },
  {
    chave: "performance",
    nome: "Performance",
    descricao: "Performance de entrega, SLA e listagem detalhada.",
    telas: ["performance"],
    essencial: false,
    ordem: 10,
  },
  {
    chave: "romaneio",
    nome: "Romaneio",
    descricao: "Romaneios, viagens, placas e motoristas.",
    telas: ["romaneio", "romaneio_placa"],
    essencial: false,
    ordem: 20,
  },
  {
    chave: "ocorrencias",
    nome: "Ocorrências",
    descricao: "Painel de ocorrências e códigos.",
    telas: ["ocorrencias", "admin_codigos"],
    essencial: false,
    ordem: 30,
  },
  {
    chave: "comprovantes",
    nome: "Comprovantes",
    descricao: "Comprovantes de entrega.",
    telas: ["comprovantes"],
    essencial: false,
    ordem: 40,
  },
  {
    chave: "coletas",
    nome: "Coletas",
    descricao: "Coletas (relatório 050).",
    telas: ["coletas"],
    essencial: false,
    ordem: 50,
  },
  {
    chave: "prazo_parceiro",
    nome: "Prazo do parceiro",
    descricao: "Prazo acordado com parceiros.",
    telas: ["prazo_parceiro"],
    essencial: false,
    ordem: 60,
  },
  {
    chave: "historico",
    nome: "Histórico e calendário",
    descricao: "Histórico, calendário e feriados.",
    telas: ["historico", "calendario", "admin_historico"],
    essencial: false,
    ordem: 70,
  },
  {
    chave: "ranking",
    nome: "Ranking",
    descricao: "Ranking de equipes e bonificação.",
    telas: ["ranking", "ranking_novo", "admin_equipes", "admin_bonificacao"],
    essencial: false,
    ordem: 80,
  },
  {
    chave: "ponto_bonificacao",
    nome: "Ponto e bonificação de entrega",
    descricao: "Integração Ahgora e bonificação de entrega.",
    telas: ["admin_ahgora", "admin_bonificacao_entrega"],
    essencial: false,
    ordem: 90,
  },
  {
    chave: "xml_cte",
    nome: "XML CT-e",
    descricao: "Importação dos XML de CT-e pelo SFTP.",
    telas: ["admin_xml_cte"],
    essencial: false,
    ordem: 100,
  },
  {
    chave: "integracao_ssw",
    nome: "Integração SSW",
    descricao: "Relatórios do SSW por SFTP, BI2 e API.",
    telas: ["admin_ingestao", "admin_importacao_ssw"],
    essencial: false,
    ordem: 110,
  },
] as const satisfies readonly {
  chave: string;
  nome: string;
  descricao: string;
  telas: readonly Tela[];
  essencial: boolean;
  ordem: number;
}[];

export type ChaveModulo = (typeof MODULOS)[number]["chave"];

export interface ModuloCatalogo {
  chave: string;
  nome: string;
  telas: readonly Tela[];
  essencial: boolean;
}

export function nomeDoModulo(chave: string): string {
  return MODULOS.find((m) => m.chave === chave)?.nome ?? chave;
}

/** Mensagem ao operador quando a tela ou a consulta é de um módulo desligado. */
export function mensagemModuloDesligado(nomes: readonly string[]): string {
  const lista = nomes.length > 0 ? nomes.join(" / ") : "desta tela";
  return `O módulo ${lista} não está liberado para esta empresa. Fale com o suporte para liberar.`;
}
