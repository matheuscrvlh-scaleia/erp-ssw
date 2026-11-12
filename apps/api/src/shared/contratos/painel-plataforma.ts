import { dataIso } from "../consulta";
import { contrato } from "../contrato";
import { STATUS_EMPRESA } from "../plataforma";
import { z } from "../zod";
import { saudeSsw } from "./ingestao-ssw";

/*
 * Plataforma › Dashboard: saúde e números de todas as empresas numa tela. Só admin da Plataforma.
 */

const instante = z.iso.datetime();
const inteiro = z.number().int();

/** `inativa` = empresa suspensa ou encerrada (não entra no ok/atenção/crítico). */
export const NIVEIS_DE_SAUDE = ["ok", "atencao", "critico", "inativa"] as const;
export type NivelDeSaude = (typeof NIVEIS_DE_SAUDE)[number];

/** Situação do worker-ssw para a empresa (pela última execução de cada job). */
export const SITUACOES_DO_WORKER = ["ok", "com_falha", "fora", "nao_configurado"] as const;
export type SituacaoDoWorker = (typeof SITUACOES_DO_WORKER)[number];

/** Os números da Performance no mês (por emissão, sem filtros); SLA em fração 0–1. */
export const numerosDaEmpresa = z.object({
  ctesNoMes: inteiro,
  entreguesNoMes: inteiro,
  emAberto: inteiro,
  /** Em aberto com o prazo vencido hoje, dos emitidos no mês (o "Em Atraso" da Performance). */
  emAtraso: inteiro,
  /** SLA Operacional; nulo sem CT-e no mês. */
  slaOperacional: z.number().nullable(),
  slaMeta: z.number(),
  /** Pela meta e pelo alerta amarelo da empresa; nulo sem SLA. */
  situacaoDoSla: z.enum(["bom", "alerta", "ruim"]).nullable(),
});
export type NumerosDaEmpresa = z.infer<typeof numerosDaEmpresa>;

export const empresaNoPainel = z.object({
  id: z.uuid(),
  nome: z.string(),
  nomeCurto: z.string(),
  status: z.enum(STATUS_EMPRESA),
  corPrimaria: z.string(),
  usuariosAtivos: inteiro,
  modulosLiberados: inteiro,
  ultimoLoginEm: instante.nullable(),
  saude: z.object({
    nivel: z.enum(NIVEIS_DE_SAUDE),
    /** O que puxou o nível para baixo, do mais grave para o mais leve. */
    motivos: z.array(z.string()),
  }),
  ssw: saudeSsw,
  workerSsw: z.object({
    situacao: z.enum(SITUACOES_DO_WORKER),
    /** Jobs cuja última execução falhou. */
    jobsComFalha: z.array(z.string()),
  }),
  /** Última aplicação do ciclo de arquivos do SSW ("Dados atualizados em"). */
  ultimoDadoEm: instante.nullable(),
  xml: z.object({ pendentes: inteiro, expirados: inteiro }),
  /** Nulo quando a consulta dos números falhou (ex.: demorou demais). */
  numeros: numerosDaEmpresa.nullable(),
});
export type EmpresaNoPainel = z.infer<typeof empresaNoPainel>;

export const painelPlataforma = z.object({
  geradoEm: instante,
  /** Mês corrente até hoje (fuso do negócio). */
  periodo: z.object({ inicio: dataIso, fim: dataIso }),
  totais: z.object({
    empresas: inteiro,
    porNivel: z.object({ ok: inteiro, atencao: inteiro, critico: inteiro, inativa: inteiro }),
    /** Soma dos vínculos ativos (quem está em duas empresas conta duas vezes). */
    usuariosAtivos: inteiro,
    ctesNoMes: inteiro,
    entreguesNoMes: inteiro,
    emAtraso: inteiro,
    /** SLA Operacional de todas as empresas juntas. */
    slaOperacional: z.number().nullable(),
  }),
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
