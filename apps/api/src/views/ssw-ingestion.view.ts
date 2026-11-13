import { type SaidaDe } from "@erp/shared/contract";
import {
  type contratosIngestaoSsw,
  type EventoWebhook,
  type SincronizacaoBi2,
  sincronizacaoBi2,
} from "@erp/shared/contracts/ssw-ingestion";

import {
  type AtualizacaoDosDados,
  type CredenciaisDaSsw,
  type DiagnosticoDaSsw,
  type EventoLido,
  type EventosDoWebhook,
  type RodadaDoBi2,
  type SincronizacaoLida,
} from "../models/ssw-ingestion/ssw-ingestion.service";

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

export function apresentarAtualizacaoDosDados(
  atualizacao: AtualizacaoDosDados,
): SaidaDe<typeof contratosIngestaoSsw.atualizacao> {
  return { ...atualizacao, atualizadoEm: iso(atualizacao.atualizadoEm) };
}

function apresentarSincronizacaoBi2(s: SincronizacaoLida): SincronizacaoBi2 {
  return { ...s, iniciadoEm: s.iniciadoEm.toISOString(), finalizadoEm: iso(s.finalizadoEm) };
}

/** A mais recente vem destacada, além da lista. */
export function apresentarStatusBi2(
  sincronizacoes: SincronizacaoLida[],
): SaidaDe<typeof contratosIngestaoSsw.bi2Status> {
  const recentes = sincronizacoes.map(apresentarSincronizacaoBi2);
  return { ultima: recentes[0] ?? null, recentes };
}

export function apresentarRodadaDoBi2(
  rodada: RodadaDoBi2,
): SaidaDe<typeof contratosIngestaoSsw.rodarBi2> {
  return {
    ...rodada,
    resultado:
      rodada.resultado && sincronizacaoBi2.parse(apresentarSincronizacaoBi2(rodada.resultado)),
  };
}

export function apresentarCredenciaisSsw(
  c: CredenciaisDaSsw,
): SaidaDe<typeof contratosIngestaoSsw.credenciais> {
  return {
    ...c,
    tokenAtualizadoEm: iso(c.tokenAtualizadoEm),
    tokenExpiraEm: iso(c.tokenExpiraEm),
    atualizadoEm: iso(c.atualizadoEm),
    ultimaVerificacao: c.ultimaVerificacao && {
      ...c.ultimaVerificacao,
      em: c.ultimaVerificacao.em.toISOString(),
    },
  };
}

/** O resumo do token da chamada fica no servidor. */
function apresentarEventoWebhook({ tokenSha256: _resumos, ...e }: EventoLido): EventoWebhook {
  return { ...e, recebidoEm: e.recebidoEm.toISOString() };
}

export function apresentarEventosWebhook(
  dados: EventosDoWebhook,
): SaidaDe<typeof contratosIngestaoSsw.eventosWebhook> {
  return {
    ultimaAtividade: iso(dados.ultimaAtividade),
    eventos: dados.eventos.map(apresentarEventoWebhook),
  };
}

export function apresentarDiagnosticoSsw(
  d: DiagnosticoDaSsw,
): SaidaDe<typeof contratosIngestaoSsw.diagnostico> {
  return {
    ...d,
    sincronizacoes: d.sincronizacoes.map(apresentarSincronizacaoBi2),
    webhook: { ...d.webhook, ultimaAtividade: iso(d.webhook.ultimaAtividade) },
    orfaos: {
      ...d.orfaos,
      recentes: d.orfaos.recentes.map((e) => ({
        id: e.id,
        recebidoEm: e.recebidoEm.toISOString(),
        numero: e.numeroCte,
      })),
    },
  };
}
