/**
 * Agregado XML de CT-e (upload manual e pasta FTP de XML).
 *
 * - `xml_cte_arquivos`: arquivo (zip ou xml) recebido; o SHA-256 deduplica reenvio.
 * - `xml_cte_itens`: cada XML dentro do arquivo; o SHA-256 do XML com sucesso deduplica.
 * - `xml_cte_orfaos`: XML cujo CT-e ainda não existe; fica guardado para casar depois, até expirar.
 * - `xml_ftp_sincronizacoes`: log de cada rodada da sincronização da pasta FTP de XML.
 *
 * Retenção (job do worker):
 * - arquivos e itens: 180 dias pelo `criado_em` (itens vão junto, em cascata). Reenvio depois disso
 *   é reprocessado, e o processamento é idempotente (upsert pelo CT-e).
 * - órfãos: `casado` e `expirado` apagados 30 dias depois de `atualizado_em` (o XML é grande).
 * - sincronizações FTP: 90 dias.
 *
 * Origem: public.xml_cte_arquivos_processados, public.xml_cte_itens_processados,
 * public.xml_cte_orfaos, public.ftp_xml_sync_log.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, empresaId, instante } from "./_comum";
import { esquemaErp, politicasDaEmpresa } from "./_contrato-fundacao";

export const xmlCteArquivos = esquemaErp.table(
  "xml_cte_arquivos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nomeArquivo: text("nome_arquivo").notNull(),
    sha256: text("sha256").notNull(),
    tipo: text("tipo", { enum: ["zip", "xml"] }).notNull(),
    status: text("status", { enum: ["sucesso", "erro", "parcial", "duplicado"] }).notNull(),
    erroMensagem: text("erro_mensagem"),
    ctesProcessados: integer("ctes_processados").notNull().default(0),
    cancelamentos: integer("cancelamentos").notNull().default(0),
    xmlsPulados: integer("xmls_pulados").notNull().default(0),
    criadoEm: criadoEm(),
  },
  (t) => [
    check("xml_cte_arquivos_tipo_ck", sql`${t.tipo} in ('zip', 'xml')`),
    check(
      "xml_cte_arquivos_status_ck",
      sql`${t.status} in ('sucesso', 'erro', 'parcial', 'duplicado')`,
    ),
    uniqueIndex("xml_cte_arquivos_sha256_uq").on(t.empresaId, t.sha256),
    index("xml_cte_arquivos_criado_idx").on(t.empresaId, t.criadoEm.desc()),
    ...politicasDaEmpresa("xml_cte_arquivos"),
  ],
);

export const xmlCteItens = esquemaErp.table(
  "xml_cte_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    arquivoId: uuid("arquivo_id").references(() => xmlCteArquivos.id, { onDelete: "cascade" }),
    sha256Xml: text("sha256_xml").notNull(),
    nomeXml: text("nome_xml").notNull(),
    tipo: text("tipo", { enum: ["cte", "can", "unknown"] }).notNull(),
    status: text("status", { enum: ["sucesso", "erro", "orfao"] }).notNull(),
    /** Número do CTRC (dígitos) lido do XML. */
    numeroCte: text("numero_cte"),
    chaveCte: text("chave_cte"),
    erroMensagem: text("erro_mensagem"),
    criadoEm: criadoEm(),
  },
  (t) => [
    check("xml_cte_itens_tipo_ck", sql`${t.tipo} in ('cte', 'can', 'unknown')`),
    check("xml_cte_itens_status_ck", sql`${t.status} in ('sucesso', 'erro', 'orfao')`),
    // XML já aplicado com sucesso não é reaplicado.
    uniqueIndex("xml_cte_itens_sha_sucesso_uq")
      .on(t.empresaId, t.sha256Xml)
      .where(sql`${t.status} = 'sucesso'`),
    index("xml_cte_itens_arquivo_idx").on(t.arquivoId, t.criadoEm.desc()),
    ...politicasDaEmpresa("xml_cte_itens"),
  ],
);

export const xmlCteOrfaos = esquemaErp.table(
  "xml_cte_orfaos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    sha256Xml: text("sha256_xml").notNull(),
    nomeXml: text("nome_xml").notNull(),
    tipo: text("tipo", { enum: ["cte", "can"] }).notNull(),
    chaveCte: text("chave_cte"),
    numeroCte: text("numero_cte"),
    xmlConteudo: text("xml_conteudo").notNull(),
    status: text("status", { enum: ["pendente", "casado", "expirado"] })
      .notNull()
      .default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    ultimaTentativa: instante("ultima_tentativa"),
    ultimoErro: text("ultimo_erro"),
    casadoEm: instante("casado_em"),
    /** Gravado pelo backend no cadastro: criado_em + 5 dias. */
    expiraEm: instante("expira_em").notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check("xml_cte_orfaos_tipo_ck", sql`${t.tipo} in ('cte', 'can')`),
    check("xml_cte_orfaos_status_ck", sql`${t.status} in ('pendente', 'casado', 'expirado')`),
    uniqueIndex("xml_cte_orfaos_sha256_uq").on(t.empresaId, t.sha256Xml),
    index("xml_cte_orfaos_chave_idx").on(t.empresaId, t.chaveCte),
    // Fila de casamento: pendentes do mais antigo para o mais novo.
    index("xml_cte_orfaos_pendentes_idx")
      .on(t.empresaId, t.criadoEm)
      .where(sql`${t.status} = 'pendente'`),
    ...politicasDaEmpresa("xml_cte_orfaos"),
  ],
);

export const xmlFtpSincronizacoes = esquemaErp.table(
  "xml_ftp_sincronizacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    executadoEm: instante("executado_em").notNull().defaultNow(),
    finalizadoEm: instante("finalizado_em"),
    status: text("status", { enum: ["ok", "parcial", "erro", "pausado"] }).notNull(),
    disparadoPor: text("disparado_por", { enum: ["agendamento", "manual"] })
      .notNull()
      .default("agendamento"),
    arquivosProcessados: integer("arquivos_processados").notNull().default(0),
    arquivosRemovidos: integer("arquivos_removidos").notNull().default(0),
    arquivosMovidos: integer("arquivos_movidos").notNull().default(0),
    pastasLimpas: integer("pastas_limpas").notNull().default(0),
    arquivosComErro: integer("arquivos_com_erro").notNull().default(0),
    ctesProcessados: integer("ctes_processados").notNull().default(0),
    duracaoMs: integer("duracao_ms").notNull().default(0),
    mensagem: text("mensagem"),
    erros: jsonb("erros")
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    check(
      "xml_ftp_sincronizacoes_status_ck",
      sql`${t.status} in ('ok', 'parcial', 'erro', 'pausado')`,
    ),
    check(
      "xml_ftp_sincronizacoes_disparado_ck",
      sql`${t.disparadoPor} in ('agendamento', 'manual')`,
    ),
    index("xml_ftp_sincronizacoes_executado_idx").on(t.empresaId, t.executadoEm.desc()),
    ...politicasDaEmpresa("xml_ftp_sincronizacoes"),
  ],
);
