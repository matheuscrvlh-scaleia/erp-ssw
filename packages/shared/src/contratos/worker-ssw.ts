/**
 * Contrato do HTTP interno ERP → worker-ssw (ADR 0012). Cópia de `worker-ssw/src/contrato-interno.ts`:
 * mesmo conteúdo nos dois repositórios, e o teste de cada lado confere os exemplos abaixo.
 *
 * Autenticação: `Authorization: Bearer <token de serviço>` (o worker-ssw aceita dois tokens para
 * girar sem queda; o ERP manda `WORKER_SSW_TOKEN`). Base: `WORKER_SSW_URL`, só na rede interna.
 */
import { z } from "../zod";

/** Jobs que o ERP pode pedir; os demais (agendados) só aparecem na situação. */
export const JOBS_PEDIVEIS = [
  "sincronizar-ftp",
  "sincronizar-ftp-retroativo",
  "aplicar-ciclos",
  "bi2-0017",
  "verificar-token-ssw",
  "processar-webhook-ssw",
  "reprocessar-xml-orfaos",
  "projecoes-romaneio",
  "projecoes-romaneio-completa",
] as const;
export type JobPedivel = (typeof JOBS_PEDIVEIS)[number];

export const ESTADOS_DA_EXECUCAO = ["na_fila", "rodando", "concluida", "falhou"] as const;

/** Teto da espera de `GET /execucoes/:job/:execucaoId?aguardarMs=`. */
export const AGUARDAR_MS_MAXIMO = 60_000;

const instante = z.iso.datetime({ offset: true });
const estado = z.enum(ESTADOS_DA_EXECUCAO);

/** `POST /interno/v1/empresas/:empresaId/execucoes`. `dados` é validado pelo zod do job. */
const pedidoDeExecucao = z.object({
  job: z.enum(JOBS_PEDIVEIS),
  dados: z.record(z.string(), z.unknown()).optional(),
  /** Chave de deduplicação: já há execução com ela na fila ou rodando = 409. */
  deduplicar: z.string().min(1).max(200).optional(),
});

/** Resposta 202 do pedido. */
const execucaoCriada = z.object({ execucaoId: z.string().min(1) });

/** Query de `GET /interno/v1/execucoes/:job/:execucaoId`: espera até terminar ou vencer. */
const consultaDaExecucao = z.object({
  aguardarMs: z.coerce.number().int().min(0).max(AGUARDAR_MS_MAXIMO).default(0),
});

/** `erro` é mensagem para o operador (português, sem detalhe interno). */
const execucao = z.object({
  estado,
  resultado: z.unknown().optional(),
  erro: z.string().optional(),
});

/** `GET /interno/v1/empresas/:empresaId/situacao`. */
const situacao = z.object({
  jobs: z.array(
    z.object({
      job: z.string().min(1),
      estado,
      ultimaExecucao: instante.optional(),
      proximaExecucao: instante.optional(),
    }),
  ),
  tokenSswGeradoEm: instante.optional(),
});

export const contratoWorkerSsw = {
  pedirExecucao: {
    metodo: "POST",
    caminho: "/interno/v1/empresas/:empresaId/execucoes",
    entrada: pedidoDeExecucao,
    saida: execucaoCriada,
  },
  consultarExecucao: {
    metodo: "GET",
    caminho: "/interno/v1/execucoes/:job/:execucaoId",
    entrada: consultaDaExecucao,
    saida: execucao,
  },
  situacao: {
    metodo: "GET",
    caminho: "/interno/v1/empresas/:empresaId/situacao",
    saida: situacao,
  },
} as const;

export type PedidoDeExecucao = z.input<typeof pedidoDeExecucao>;
export type Execucao = z.output<typeof execucao>;
export type SituacaoDoWorkerSsw = z.output<typeof situacao>;

/** Exemplos do contrato: os dois lados conferem que continuam válidos. */
export const EXEMPLOS_DO_CONTRATO = {
  pedirExecucao: {
    entrada: {
      job: "bi2-0017",
      dados: { modo: "manual", data: "2026-11-09", lookback: 0 },
      deduplicar: "bi2-0017__2026-11-09",
    },
    saida: { execucaoId: "1234" },
  },
  consultarExecucao: {
    entrada: { aguardarMs: "30000" },
    saida: [
      { estado: "na_fila" },
      { estado: "rodando" },
      { estado: "concluida", resultado: { ok: true, renovado: true } },
      { estado: "falhou", erro: "O SSW recusou o usuário ou a senha." },
    ],
  },
  situacao: {
    saida: {
      jobs: [
        {
          job: "sincronizar-ftp",
          estado: "concluida",
          ultimaExecucao: "2026-11-10T12:01:05.000Z",
          proximaExecucao: "2026-11-10T12:02:00.000Z",
        },
        { job: "aplicar-ciclos", estado: "rodando", ultimaExecucao: "2026-11-10T12:01:00.000Z" },
      ],
      tokenSswGeradoEm: "2026-11-10T11:25:00.000Z",
    },
  },
} as const;
