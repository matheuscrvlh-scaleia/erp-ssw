/**
 * Contratos das telas de ingestão SSW (Admin › Importação SSW e Admin › XML CT-e), só Plataforma.
 * Spec 06 §5.
 */
import { contrato } from "@erp/shared/contrato";
import { z } from "@erp/shared/zod";

const RELATORIOS_MANUAIS = ["036", "038", "306", "455csv", "930"] as const;

const instante = z.string();
const ok = z.object({ ok: z.literal(true) });

const ciclo = z.object({
  cicloChave: z.string(),
  status: z.string(),
  motivo: z.string().nullable(),
  faltantes: z.array(z.string()),
  totais: z.record(z.string(), z.unknown()),
  arquivosImportados: z.number().int(),
  linhasImportadas: z.number().int(),
  primeiroArquivoEm: instante,
  ultimoArquivoEm: instante,
  fechadoEm: instante.nullable(),
  aplicadoEm: instante.nullable(),
});
export type CicloDaIngestao = z.infer<typeof ciclo>;

const arquivo = z.object({
  nomeArquivo: z.string(),
  cicloChave: z.string().nullable(),
  relatorio: z.string().nullable(),
  unidade: z.string().nullable(),
  status: z.string(),
  linhas: z.number().int(),
  mensagem: z.string().nullable(),
  vistoEm: instante,
  importadoEm: instante.nullable(),
});
export type ArquivoDaIngestao = z.infer<typeof arquivo>;

const totaisDoBloco = z.object({
  inserir: z.number().int(),
  atualizar: z.number().int(),
  ocorrencias: z.number().int(),
  ignorados: z.number().int(),
});

const resultadoDoBloco = z.object({
  dryRun: z.boolean(),
  offset: z.number().int(),
  processados: z.number().int(),
  candidatos: z.number().int(),
  pendentes: z.number().int(),
  totais: totaisDoBloco,
  inserir: z.array(
    z.object({
      chave: z.string(),
      dataEmissao: z.string().nullable(),
      previsao: z.string().nullable(),
    }),
  ),
  atualizar: z.array(z.object({ chave: z.string(), campos: z.array(z.string()) })),
  ocorrencias: z.array(
    z.object({ chave: z.string(), codigo: z.number().int(), dataHora: z.string() }),
  ),
  ignorados: z.array(z.object({ chave: z.string(), motivo: z.string() })),
  temMais: z.boolean(),
  romaneio036: z.number().int().nullable(),
});
export type ResultadoDoBlocoDeAplicacao = z.infer<typeof resultadoDoBloco>;

const aplicacao = z.object({
  id: z.uuid(),
  status: z.enum(["em_andamento", "concluido", "erro"]),
  simulacao: z.boolean(),
  totalInseridos: z.number().int(),
  totalAtualizados: z.number().int(),
  totalOcorrencias: z.number().int(),
  totalIgnorados: z.number().int(),
  erro: z.string().nullable(),
  iniciadoEm: instante,
  finalizadoEm: instante.nullable(),
});
export type AplicacaoDaIngestao = z.infer<typeof aplicacao>;

const sincronizacao = z.object({
  executadoEm: instante,
  finalizadoEm: instante.nullable(),
  status: z.enum(["ok", "parcial", "erro", "pausado"]),
  disparadoPor: z.enum(["agendamento", "manual"]),
  arquivosProcessados: z.number().int(),
  arquivosMovidos: z.number().int(),
  pastasLimpas: z.number().int(),
  arquivosComErro: z.number().int(),
  duracaoMs: z.number().int(),
  mensagem: z.string().nullable(),
  erros: z.array(z.string()),
});
export type SincronizacaoDoFtp = z.infer<typeof sincronizacao>;

const progresso = z.object({
  fase: z.enum(["conectando", "processando", "relatorios", "retroativo", "concluido"]),
  totalArquivos: z.number().int(),
  arquivoAtualIndice: z.number().int(),
  arquivoAtualNome: z.string().nullable(),
  mensagem: z.string().nullable(),
  iniciadoEm: instante.nullable(),
  heartbeatEm: instante.nullable(),
  finalizadoEm: instante.nullable(),
});

const arquivoXml = z.object({
  id: z.uuid(),
  nomeArquivo: z.string(),
  tipo: z.enum(["zip", "xml"]),
  status: z.enum(["sucesso", "erro", "parcial", "duplicado"]),
  erroMensagem: z.string().nullable(),
  ctesProcessados: z.number().int(),
  cancelamentos: z.number().int(),
  xmlsPulados: z.number().int(),
  criadoEm: instante,
});
export type ArquivoXml = z.infer<typeof arquivoXml>;

const resultadoDoXml = z.object({
  arquivo: z.string(),
  status: z.enum(["sucesso", "erro", "parcial", "duplicado"]),
  ctesProcessados: z.number().int(),
  cancelamentos: z.number().int(),
  orfaos: z.number().int(),
  pulados: z.number().int(),
  erros: z.array(z.object({ nome: z.string(), erro: z.string() })),
});
export type ResultadoDoXml = z.infer<typeof resultadoDoXml>;

const parametrosCiclo = z.object({ chave: z.string().min(1) });
const BASE = "/api/v1/admin/ingestao";

export const contratosIngestao = {
  pipeline: contrato({
    metodo: "GET",
    caminho: `${BASE}/pipeline`,
    saida: z.object({
      ciclos: z.array(ciclo),
      arquivos: z.array(arquivo),
      esperados: z.array(
        z.object({
          relatorio: z.string(),
          porUnidade: z.boolean(),
          unidadesEsperadas: z.array(z.string()),
          obrigatorioNoCiclo: z.boolean(),
          ativo: z.boolean(),
        }),
      ),
      filaPendente: z.number().int(),
      aplicacaoRodando: z.boolean(),
    }),
  }),
  retomarCiclo: contrato({
    metodo: "POST",
    caminho: `${BASE}/ciclos/:chave/retomar`,
    parametros: parametrosCiclo,
    saida: z.object({
      cicloChave: z.string(),
      status: z.enum(["nada_a_fazer", "aguardando", "aplicado", "erro"]),
      motivo: z.string().nullable(),
    }),
  }),
  descartarCiclo: contrato({
    metodo: "POST",
    caminho: `${BASE}/ciclos/:chave/descartar`,
    parametros: parametrosCiclo,
    entrada: z.object({
      motivo: z.string().trim().min(3, "Informe o motivo do descarte.").max(500),
    }),
    saida: z.object({ cicloChave: z.string(), totalRemovido: z.number().int() }),
  }),
  importarRelatorio: contrato({
    metodo: "POST",
    caminho: `${BASE}/relatorios`,
    entrada: z.object({
      relatorio: z.enum(RELATORIOS_MANUAIS),
      conteudo: z.string().min(1, "Arquivo vazio."),
      nome: z.string().max(300).nullable(),
      aceitarDivergencia: z.boolean().default(false),
    }),
    saida: z.object({ loteId: z.uuid(), gravados: z.number().int(), erros: z.number().int() }),
  }),
  aplicar: contrato({
    metodo: "POST",
    caminho: `${BASE}/aplicar`,
    entrada: z.object({
      dryRun: z.boolean(),
      limite: z.number().int().min(1).max(20_000).default(4000),
      offset: z.number().int().min(0).default(0),
    }),
    saida: resultadoDoBloco,
  }),
  aplicacoes: contrato({
    metodo: "GET",
    caminho: `${BASE}/aplicacoes`,
    saida: z.object({ aplicacoes: z.array(aplicacao) }),
  }),
  ftp: contrato({
    metodo: "GET",
    caminho: `${BASE}/ftp`,
    saida: z.object({
      ativo: z.boolean(),
      agenda: z.string(),
      travaAtiva: z.boolean(),
      progresso: progresso.nullable(),
      historico: z.array(sincronizacao),
    }),
  }),
  rodarFtp: contrato({ metodo: "POST", caminho: `${BASE}/ftp/rodar`, saida: ok }),
  pausarFtp: contrato({
    metodo: "POST",
    caminho: `${BASE}/ftp/ativo`,
    entrada: z.object({ ativo: z.boolean() }),
    saida: ok,
  }),
  liberarTravaFtp: contrato({ metodo: "POST", caminho: `${BASE}/ftp/liberar-trava`, saida: ok }),
  importarXml: contrato({
    metodo: "POST",
    caminho: `${BASE}/xml`,
    entrada: z.object({ nome: z.string().min(1).max(300), base64: z.string().min(1) }),
    saida: resultadoDoXml,
  }),
  arquivosXml: contrato({
    metodo: "GET",
    caminho: `${BASE}/xml`,
    saida: z.object({
      arquivos: z.array(arquivoXml),
      orfaos: z.object({
        pendentes: z.number().int(),
        expirados: z.number().int(),
        casados: z.number().int(),
        maisAntigo: instante.nullable(),
      }),
    }),
  }),
  reprocessarOrfaos: contrato({
    metodo: "POST",
    caminho: `${BASE}/xml/orfaos`,
    saida: z.object({
      expirados: z.number().int(),
      tentados: z.number().int(),
      casados: z.number().int(),
    }),
  }),
} as const;
