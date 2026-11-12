import { comInstantes, type Sql, sql, type Transacao } from "@erp/db";
import { type ContagemWebhook } from "@erp/shared/contratos/ingestao-ssw";

import {
  type EventoLido,
  type RepositorioIngestaoSsw,
  type SincronizacaoLida,
} from "./ingestao-ssw.service";

/** `e` = `erp.ssw_webhook_eventos`, `ctes` = o CT-e ligado (left join). */
const colunasDoEvento = (numeroCte: Sql) => sql`
  e.id, e.recebido_em as "recebidoEm", e.status_http as "statusHttp", e.autenticado,
  e.motivo_rejeicao as "motivoRejeicao", e.erro_processamento as "erroProcessamento",
  e.cte_id as "cteId", ${numeroCte} as "numeroCte",
  e.payload_bruto is not null as "temPayload", e.token_sha256 as "tokenSha256"`;

const EVENTOS_COM_CTE = sql`
  erp.ssw_webhook_eventos e left join erp.ctes on ctes.id = e.cte_id`;

/** Mesma classificação da tela: rejeitado (auth/4xx), erro (5xx), sem vínculo (202), processado. */
const ehRejeitado = sql`(not e.autenticado or e.status_http between 400 and 499)`;

/** Número que o SSW mandou (para evento sem CT-e). */
const numeroDoPayload = sql`coalesce(
  nullif(e.payload_bruto->'cte'->>'numeroCTe', ''),
  nullif(nullif(e.payload_bruto->'cte'->>'numeroSSW', ''), '0'),
  e.payload_bruto->'nf'->>'numeroNFe')`;

function segredoDaLinha(cifrado: string | null, versao: number | null) {
  return cifrado === null || versao === null ? null : { cifrado, versaoChave: versao };
}

interface LinhaDaIntegracao {
  ativo: boolean;
  parametros: Record<string, unknown>;
  segredoCifrado: string | null;
  segredoVersaoChave: number | null;
  segredoAnteriorCifrado: string | null;
  segredoAnteriorVersaoChave: number | null;
  ultimoTesteEm: Date | null;
  ultimoTesteOk: boolean | null;
  ultimoTesteMsg: string | null;
  atualizadoEm: Date;
}

/** Leituras no contexto da sessão (RLS = empresa ativa); escrita com a empresa explícita. */
export function criarRepositorioIngestaoSsw(tx: Transacao): RepositorioIngestaoSsw {
  const eventos = async (resto: Sql) =>
    comInstantes<EventoLido>(
      await tx.consultar(sql`
        select ${colunasDoEvento(sql`ctes.numero`)} from ${EVENTOS_COM_CTE} ${resto}`),
      ["recebidoEm"],
    );

  /** Um instante (`max`, último) ou nulo. */
  const instante = async (consulta: Sql) => {
    const [linha] = await tx.consultar<{ em: string | null }>(consulta);
    return linha?.em ? new Date(linha.em) : null;
  };

  return {
    integracao: async (empresaId, tipo) => {
      const [linha] = comInstantes<LinhaDaIntegracao>(
        await tx.consultar(sql`
          select ativo, parametros, segredo_cifrado as "segredoCifrado",
                 segredo_versao_chave as "segredoVersaoChave",
                 segredo_anterior_cifrado as "segredoAnteriorCifrado",
                 segredo_anterior_versao_chave as "segredoAnteriorVersaoChave",
                 ultimo_teste_em as "ultimoTesteEm", ultimo_teste_ok as "ultimoTesteOk",
                 ultimo_teste_msg as "ultimoTesteMsg", atualizado_em as "atualizadoEm"
          from erp.empresa_integracoes
          where empresa_id = ${empresaId} and tipo = ${tipo}`),
        ["ultimoTesteEm", "atualizadoEm"],
      );
      if (!linha) return null;
      const {
        segredoCifrado,
        segredoVersaoChave,
        segredoAnteriorCifrado,
        segredoAnteriorVersaoChave,
        ...resto
      } = linha;
      const segredo = segredoDaLinha(segredoCifrado, segredoVersaoChave);
      return {
        ...resto,
        segredo,
        segredoAnterior: segredoDaLinha(segredoAnteriorCifrado, segredoAnteriorVersaoChave),
        temSegredo: segredo !== null,
      };
    },

    salvarIntegracao: async (empresaId, tipo, { parametros, segredo }, usuarioId, agora) => {
      // Sem segredo novo, o gravado fica como está.
      const doSegredo = segredo
        ? sql`, segredo_cifrado = excluded.segredo_cifrado,
              segredo_versao_chave = excluded.segredo_versao_chave,
              segredo_definido_em = excluded.segredo_definido_em`
        : sql.vazio();
      await tx.executar(sql`
        insert into erp.empresa_integracoes (empresa_id, tipo, parametros, segredo_cifrado,
          segredo_versao_chave, segredo_definido_em, atualizado_por)
        values (${empresaId}, ${tipo}, ${sql.json(parametros)}, ${segredo?.cifrado ?? null},
          ${segredo?.versaoChave ?? null}, ${segredo ? agora : null}, ${usuarioId})
        on conflict (empresa_id, tipo) do update
        set parametros = excluded.parametros, atualizado_em = ${agora},
            atualizado_por = excluded.atualizado_por ${doSegredo}`);
    },

    sincronizacoesBi2: async (relatorio, limite) =>
      comInstantes<SincronizacaoLida>(
        await tx.consultar(sql`
          select codigo_relatorio as relatorio, data_alvo as "dataAlvo",
                 data_fechamento_ssw as "dataFechamentoSsw", modo, status,
                 total_linhas as "totalLinhas", criados, atualizados, erro,
                 iniciado_em as "iniciadoEm", finalizado_em as "finalizadoEm"
          from erp.bi2_sincronizacoes
          ${relatorio === null ? sql.vazio() : sql`where codigo_relatorio = ${relatorio}`}
          order by iniciado_em desc
          limit ${limite}`),
        ["iniciadoEm", "finalizadoEm"],
      ),

    eventosWebhook: (limite) => eventos(sql`order by e.recebido_em desc limit ${limite}`),

    evento: async (id) => (await eventos(sql`where e.id = ${id}`))[0] ?? null,

    eventosComMotivo: (motivo, limite) =>
      tx.consultar(sql`
        select id, token_sha256 as "tokenSha256" from erp.ssw_webhook_eventos
        where motivo_rejeicao = ${motivo} and payload_bruto is not null
        order by recebido_em desc
        limit ${limite}`),

    contagemWebhook: async (desde) => {
      const [linha] = await tx.consultar<Omit<ContagemWebhook, "processados">>(sql`
        select count(*)::int as total,
               (count(*) filter (where ${ehRejeitado}))::int as rejeitados,
               (count(*) filter (where not ${ehRejeitado} and e.status_http >= 500))::int as erros,
               (count(*) filter (where not ${ehRejeitado} and e.status_http = 202))::int
                 as "semVinculo"
        from erp.ssw_webhook_eventos e
        where e.recebido_em >= ${desde}`);
      const c = linha ?? { total: 0, rejeitados: 0, erros: 0, semVinculo: 0 };
      return { ...c, processados: c.total - c.rejeitados - c.erros - c.semVinculo };
    },

    // "Última atividade do webhook" (era sync_state.ultima_hot — Q45 do dono).
    ultimaAtividadeWebhook: () =>
      instante(sql`
        select max(recebido_em) as em from erp.ssw_webhook_eventos
        where autenticado and status_http = 200`),

    semVinculo: async (desde, limite) => {
      const filtro = sql`e.recebido_em >= ${desde} and e.autenticado and e.status_http = 202`;
      const [total] = await tx.consultar<{ n: number }>(sql`
        select count(*)::int as n from erp.ssw_webhook_eventos e where ${filtro}`);
      const recentes = comInstantes<EventoLido>(
        await tx.consultar(sql`
          select ${colunasDoEvento(numeroDoPayload)}
          from ${EVENTOS_COM_CTE}
          where ${filtro}
          order by e.recebido_em desc
          limit ${limite}`),
        ["recebidoEm"],
      );
      return { total: total?.n ?? 0, recentes };
    },

    xmlOrfaos: async () => {
      const [linha] = await tx.consultar<{ pendentes: number; expirados: number }>(sql`
        select (count(*) filter (where status = 'pendente'))::int as pendentes,
               (count(*) filter (where status = 'expirado'))::int as expirados
        from erp.xml_cte_orfaos
        where status in ('pendente', 'expirado')`);
      return { pendentes: linha?.pendentes ?? 0, expirados: linha?.expirados ?? 0 };
    },

    ultimaAplicacao: () =>
      instante(sql`
        select aplicado_em as em from erp.ingestao_ciclos
        where status = 'aplicado' and aplicado_em is not null
        order by aplicado_em desc
        limit 1`),

    marcarReprocesso: async (id) => {
      await tx.executar(sql`
        update erp.ssw_webhook_eventos
        set autenticado = true, erro_processamento = 'reenviado para processamento'
        where id = ${id}`);
    },
  };
}
