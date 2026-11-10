/*
 * Banco falso dos jobs de ingestão: implementa os repositórios do worker sobre arrays (sem SQL nem
 * RLS) e registra o contexto de cada transação.
 */
import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import {
  type CodigoNovo,
  CONFIGURACAO_PADRAO,
  type OcorrenciaDoCte,
  type TrocaDePrevisao,
} from "@erp/dominio/nucleo";
import { CATALOGO_FR } from "@erp/dominio/nucleo/apoio-testes";
import { type IntegracaoDaIngestao } from "@erp/shared/ingestao";

import { type SincronizacaoNova } from "../fontes/bi2/job";
import { type ContextoDaEmpresa, type CteGravado, cteVazio } from "../fontes/comum/cte-nucleo";
import { type IntegracaoGravada, type VerificacaoDaIntegracao } from "../fontes/comum/integracao";
import { type OcorrenciaDoWebhook, type ResultadoDoEvento } from "../fontes/webhook/job";
import { type ExecutorDoWorker, type RepositoriosDoWorker } from "../jobs/registro";

export const EMPRESA = "0b9a2c3e-1d4f-4a5b-8c6d-7e8f9a0b1c2d";

export function cteGravado(extra: Partial<CteGravado> = {}): CteGravado {
  return {
    ...cteVazio({
      sigla: "CAP",
      numero: "33214",
      dataEmissao: "2026-11-01",
      criadoEm: new Date("2026-11-01T12:00:00Z"),
    }),
    id: randomUUID(),
    ...extra,
  };
}

export class BancoFalso {
  contextos: ContextoBanco[] = [];
  ctes: CteGravado[] = [];
  ocorrencias: (OcorrenciaDoCte & OcorrenciaDoWebhook)[] = [];
  trocas: (TrocaDePrevisao & { cteId: string })[] = [];
  bruto = new Map<string, { dataAlvo: string; payload: Record<string, string> }>();
  sincronizacoes: SincronizacaoNova[] = [];
  eventos = new Map<string, { payload: unknown; resultado: ResultadoDoEvento | null }>();
  codigosCadastrados: CodigoNovo[] = [];
  apelidos = new Map<string, string>();
  integracoes = new Map<IntegracaoDaIngestao, IntegracaoGravada>();
  verificacoes: (VerificacaoDaIntegracao & { tipo: string })[] = [];
  empresas: { id: string; integracoes: IntegracaoDaIngestao[] }[] = [];
  contexto: ContextoDaEmpresa = {
    catalogo: CATALOGO_FR,
    filiais: [{ sigla: "CAP", cidade: "CAMPINAS", uf: "SP", propria: true }],
    regrasDePrazo: [],
    config: CONFIGURACAO_PADRAO,
    dominioSsw: "FRT",
  };
  /** Faz a próxima transação falhar com este erro. */
  falharCom: Error | null = null;

  readonly executar: ExecutorDoWorker = async (contexto, fn) => {
    this.contextos.push(contexto);
    if (this.falharCom) {
      const erro = this.falharCom;
      this.falharCom = null;
      throw erro;
    }
    return fn(this.repositorios());
  };

  private repositorios(): RepositoriosDoWorker {
    return {
      agendamentos: {
        empresasAtivas: () => Promise.resolve([]),
        empresasComIntegracao: (tipo) =>
          Promise.resolve(
            this.empresas.filter((e) => e.integracoes.includes(tipo)).map(({ id }) => ({ id })),
          ),
      },
      manutencao: {
        apagarSessoesEncerradas: () => Promise.resolve(0),
        apagarTokensDeSenhaVencidos: () => Promise.resolve(0),
        apagarIngestaoSswAntiga: () => Promise.resolve({}),
      },
      slaArquivos: {
        feriados: () => Promise.resolve([]),
        candidatos: () => Promise.resolve([]),
        gravar: () => Promise.resolve(),
      },
      integracoes: {
        ler: (_empresa, tipo) => Promise.resolve(this.integracoes.get(tipo) ?? null),
        registrarVerificacao: (_empresa, tipo, v) => {
          this.verificacoes.push({ ...v, tipo });
          return Promise.resolve();
        },
      },
      cteNucleo: {
        contextoDaEmpresa: () => Promise.resolve(this.contexto),
        ocorrenciasDosCtes: (ids) =>
          Promise.resolve(
            new Map(ids.map((id) => [id, this.ocorrencias.filter((o) => o.cteId === id)])),
          ),
        atualizarCte: (cte) => {
          this.ctes = this.ctes.map((c) => (c.id === cte.id ? cte : c));
          return Promise.resolve();
        },
        inserirCte: (cte) => {
          const gravado = { ...cte, id: randomUUID() };
          this.ctes.push(gravado);
          return Promise.resolve(gravado);
        },
        registrarTrocaDePrevisao: (cteId, troca) => {
          this.trocas.push({ ...troca, cteId });
          return Promise.resolve();
        },
      },
      bi2: {
        ctesPorNumeros: (numeros) =>
          Promise.resolve(this.ctes.filter((c) => numeros.includes(c.numero))),
        gravarBruto: (_codigo, dataAlvo, linhas) => {
          for (const l of linhas) this.bruto.set(l.numero, { dataAlvo, payload: l.payload });
          return Promise.resolve();
        },
        registrarSincronizacao: (s) => {
          this.sincronizacoes.push(s);
          return Promise.resolve();
        },
      },
      webhook: {
        payloadDoEvento: (id) => {
          const e = this.eventos.get(id);
          return Promise.resolve(e ? { payload: e.payload } : null);
        },
        atualizarEvento: (id, resultado) => {
          const e = this.eventos.get(id);
          if (e) e.resultado = resultado;
          return Promise.resolve();
        },
        ctePorSiglaENumero: (sigla, numero) =>
          Promise.resolve(this.ctes.find((c) => c.sigla === sigla && c.numero === numero) ?? null),
        ctesPorNumero: (numero) => Promise.resolve(this.ctes.filter((c) => c.numero === numero)),
        filialPorCidade: (cidade) => Promise.resolve(this.apelidos.get(cidade) ?? null),
        cadastrarCodigo: (codigo) => {
          this.codigosCadastrados.push(codigo);
          return Promise.resolve();
        },
        gravarOcorrencia: (o) => {
          const existente = this.ocorrencias.find(
            (x) =>
              x.cteId === o.cteId &&
              x.codigo === o.codigo &&
              x.dataHora.getTime() === o.dataHora.getTime(),
          );
          if (existente) {
            Object.assign(existente, o);
            return Promise.resolve(existente.id);
          }
          const id = randomUUID();
          this.ocorrencias.push({ ...o, id, origem: "webhook", criadoEm: new Date() });
          return Promise.resolve(id);
        },
      },
    };
  }
}
