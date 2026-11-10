import { type IntegracaoDaIngestao } from "@erp/shared/ingestao";

import { type CicloLido, type RepositorioIngestao } from "../modulos/ingestao/casos-de-uso";
import {
  type EventoLido,
  type IntegracaoLida,
  type RepositorioIngestaoSsw,
  type SincronizacaoLida,
} from "../modulos/ingestao-ssw/casos-de-uso";

/** Evento do webhook como o worker-ssw o grava em `ssw_webhook_eventos`. */
export interface EventoGravado {
  id: string;
  recebidoEm: Date;
  cteId: string | null;
  autenticado: boolean;
  motivoRejeicao: string | null;
  statusHttp: number;
  payloadBruto: unknown;
  tokenSha256: string[] | null;
  erroProcessamento: string | null;
}

/** Parte de ingestão SSW do banco falso (sem RLS: os testes conferem o contexto à parte). */
export class IngestaoEmMemoria {
  integracoes = new Map<string, IntegracaoLida>();
  eventos: EventoGravado[] = [];
  sincronizacoes: SincronizacaoLida[] = [];
  ultimaAplicacao: Date | null = null;
  ciclos: (CicloLido & { empresaId: string })[] = [];
  ftpAtivo = new Map<string, boolean>();

  /** Repositório das telas Admin › Importação SSW e XML CT-e. */
  repositorioDasTelas(): RepositorioIngestao {
    return {
      ultimosCiclos: (empresaId, limite) =>
        Promise.resolve(this.ciclos.filter((c) => c.empresaId === empresaId).slice(0, limite)),
      ultimosArquivos: () => Promise.resolve([]),
      relatoriosEsperados: () => Promise.resolve([]),
      ultimasAplicacoes: () => Promise.resolve([]),
      ftpAtivo: (empresaId) => Promise.resolve(this.ftpAtivo.get(empresaId) ?? true),
      ultimasSincronizacoes: () => Promise.resolve([]),
      ultimosArquivosXml: () => Promise.resolve([]),
      estatisticasDosOrfaos: () =>
        Promise.resolve({ pendentes: 0, expirados: 0, casados: 0, maisAntigo: null }),
    };
  }

  repositorio(): RepositorioIngestaoSsw {
    const lido = (e: EventoGravado): EventoLido => ({
      id: e.id,
      recebidoEm: e.recebidoEm,
      statusHttp: e.statusHttp,
      autenticado: e.autenticado,
      motivoRejeicao: e.motivoRejeicao,
      erroProcessamento: e.erroProcessamento,
      cteId: e.cteId,
      numeroCte: null,
      temPayload: e.payloadBruto !== null,
      tokenSha256: e.tokenSha256,
    });
    const recentes = () => [...this.eventos].sort((a, b) => +b.recebidoEm - +a.recebidoEm);
    const chave = (empresaId: string, tipo: IntegracaoDaIngestao) => `${empresaId}:${tipo}`;
    return {
      integracao: (empresaId, tipo) =>
        Promise.resolve(this.integracoes.get(chave(empresaId, tipo)) ?? null),
      salvarIntegracao: (empresaId, tipo, { parametros, segredo }, _usuarioId, agora) => {
        const atual = this.integracoes.get(chave(empresaId, tipo));
        const novoSegredo = segredo ?? atual?.segredo ?? null;
        this.integracoes.set(chave(empresaId, tipo), {
          ativo: atual?.ativo ?? false,
          parametros,
          segredo: novoSegredo,
          segredoAnterior: atual?.segredoAnterior ?? null,
          temSegredo: novoSegredo !== null,
          ultimoTesteEm: atual?.ultimoTesteEm ?? null,
          ultimoTesteOk: atual?.ultimoTesteOk ?? null,
          ultimoTesteMsg: atual?.ultimoTesteMsg ?? null,
          atualizadoEm: agora,
        });
        return Promise.resolve();
      },
      sincronizacoesBi2: (relatorio, limite) =>
        Promise.resolve(
          this.sincronizacoes
            .filter((s) => relatorio === null || s.relatorio === relatorio)
            .slice(0, limite),
        ),
      eventosWebhook: (limite) => Promise.resolve(recentes().slice(0, limite).map(lido)),
      evento: (id) => {
        const e = this.eventos.find((x) => x.id === id);
        return Promise.resolve(e ? lido(e) : null);
      },
      eventosComMotivo: (motivo, limite) =>
        Promise.resolve(
          recentes()
            .filter((e) => e.motivoRejeicao === motivo && e.payloadBruto !== null)
            .slice(0, limite)
            .map((e) => ({ id: e.id, tokenSha256: e.tokenSha256 })),
        ),
      contagemWebhook: (desde) => {
        const janela = this.eventos.filter((e) => e.recebidoEm >= desde);
        const rejeitado = (e: EventoGravado) =>
          !e.autenticado || (e.statusHttp >= 400 && e.statusHttp < 500);
        const rejeitados = janela.filter(rejeitado).length;
        const erros = janela.filter((e) => !rejeitado(e) && e.statusHttp >= 500).length;
        const semVinculo = janela.filter((e) => !rejeitado(e) && e.statusHttp === 202).length;
        return Promise.resolve({
          total: janela.length,
          rejeitados,
          erros,
          semVinculo,
          processados: janela.length - rejeitados - erros - semVinculo,
        });
      },
      ultimaAtividadeWebhook: () =>
        Promise.resolve(
          recentes().find((e) => e.autenticado && e.statusHttp === 200)?.recebidoEm ?? null,
        ),
      semVinculo: (desde, limite) => {
        const lista = recentes().filter(
          (e) => e.recebidoEm >= desde && e.autenticado && e.statusHttp === 202,
        );
        return Promise.resolve({ total: lista.length, recentes: lista.slice(0, limite).map(lido) });
      },
      xmlOrfaos: () => Promise.resolve({ pendentes: 0, expirados: 0 }),
      ultimaAplicacao: () => Promise.resolve(this.ultimaAplicacao),
      marcarReprocesso: (id) => {
        const e = this.eventos.find((x) => x.id === id);
        if (e)
          Object.assign(e, {
            autenticado: true,
            erroProcessamento: "reenviado para processamento",
          });
        return Promise.resolve();
      },
    };
  }
}
