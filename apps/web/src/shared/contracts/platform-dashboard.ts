import { contrato } from "@erp/shared/contract";
import { STATUS_EMPRESA, TIPOS_INTEGRACAO } from "@erp/shared/platform";
import { z } from "@erp/shared/zod";

import { saudeSsw } from "./ssw-ingestion";

/*
 * Plataforma › Dashboard: as empresas da Plataforma numa tela — quantas são, como crescem, as
 * integrações e o uso. Só a equipe da Plataforma.
 */

const instante = z.iso.datetime();
const inteiro = z.number().int();

/** `inativa` = empresa suspensa ou encerrada (não entra no ok/atenção/crítico). */
export const NIVEIS_DE_SAUDE = ["ok", "atencao", "critico", "inativa"] as const;
export type NivelDeSaude = (typeof NIVEIS_DE_SAUDE)[number];

/** Situação do worker-ssw para a empresa (pela última execução de cada job). */
export const SITUACOES_DO_WORKER = ["ok", "com_falha", "fora", "nao_configurado"] as const;
export type SituacaoDoWorker = (typeof SITUACOES_DO_WORKER)[number];

export const empresaNoPainel = z.object({
  id: z.uuid(),
  nome: z.string(),
  nomeCurto: z.string(),
  status: z.enum(STATUS_EMPRESA),
  corPrimaria: z.string(),
  /** Quando a empresa entrou na Plataforma. */
  criadaEm: instante,
  /** Vínculos ativos. */
  usuariosAtivos: inteiro,
  /** Dos vínculos ativos, quantos entraram nos últimos 30 dias. */
  usuariosNoMes: inteiro,
  modulosLiberados: inteiro,
  ultimoLoginEm: instante.nullable(),
  saude: z.object({
    nivel: z.enum(NIVEIS_DE_SAUDE),
    /** O que puxou o nível para baixo, do mais grave para o mais leve. */
    motivos: z.array(z.string()),
  }),
  /** Integrações ligadas no cadastro da empresa. */
  integracoes: z.array(z.enum(TIPOS_INTEGRACAO)),
  ssw: saudeSsw,
  workerSsw: z.object({
    situacao: z.enum(SITUACOES_DO_WORKER),
    /** Jobs cuja última execução falhou. */
    jobsComFalha: z.array(z.string()),
  }),
  /** Última aplicação do ciclo de arquivos do SSW ("Dados atualizados em"). */
  ultimoDadoEm: instante.nullable(),
  xml: z.object({ pendentes: inteiro, expirados: inteiro }),
  /** CT-e emitidos em cada mês de `meses`; nulo quando a contagem falhou. */
  ctesPorMes: z.array(inteiro).nullable(),
});
export type EmpresaNoPainel = z.infer<typeof empresaNoPainel>;

const porStatus = z.object({
  implantacao: inteiro,
  ativa: inteiro,
  suspensa: inteiro,
  encerrada: inteiro,
});

export const painelPlataforma = z.object({
  geradoEm: instante,
  /** Os 12 meses do crescimento ("AAAA-MM"), do mais antigo ao corrente (fuso do negócio). */
  meses: z.array(z.string()),
  totais: z.object({
    empresas: inteiro,
    porStatus,
    porNivel: z.object({ ok: inteiro, atencao: inteiro, critico: inteiro, inativa: inteiro }),
    /** Empresas cadastradas no mês corrente. */
    novasNoMes: inteiro,
    /** Empresas cadastradas nos 12 meses. */
    novasNoAno: inteiro,
    /** Soma dos vínculos ativos (quem está em duas empresas conta duas vezes). */
    usuariosAtivos: inteiro,
    usuariosNoMes: inteiro,
    /** CT-e emitidos por mês, todas as empresas (mesma ordem de `meses`). */
    ctesPorMes: z.array(inteiro),
  }),
  /** Por mês: empresas novas e o total cadastrado até o fim dele. */
  crescimento: z.array(z.object({ mes: z.string(), novas: inteiro, total: inteiro })),
  /** Quantas empresas têm cada integração ligada. */
  integracoes: z.array(z.object({ tipo: z.enum(TIPOS_INTEGRACAO), empresas: inteiro })),
  /** Da saúde mais grave à mais leve; empate pelo nome. */
  empresas: z.array(empresaNoPainel),
});
export type PainelPlataforma = z.infer<typeof painelPlataforma>;

export const contratosPainelPlataforma = {
  obter: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/painel",
    saida: painelPlataforma,
  }),
};
