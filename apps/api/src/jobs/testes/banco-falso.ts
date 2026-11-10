/*
 * Banco falso dos jobs do ERP: implementa os repositórios dos jobs sobre arrays (sem SQL nem RLS)
 * e registra o contexto de cada transação.
 */
import { randomUUID } from "node:crypto";

import { type ContextoBanco } from "@erp/db";
import {
  type CadastrosDoNucleo,
  CONFIGURACAO_PADRAO,
  type CteGravado,
  type OcorrenciaDoCte,
  type TrocaDePrevisao,
} from "@erp/dominio/nucleo";
import { CATALOGO_FR, cte } from "@erp/dominio/testes/nucleo";

import { type ExecutorDosJobs, type RepositoriosDosJobs } from "../registro";

export const EMPRESA = "0b9a2c3e-1d4f-4a5b-8c6d-7e8f9a0b1c2d";

export function cteGravado(extra: Partial<CteGravado> = {}): CteGravado {
  return {
    ...cte({ dataEmissao: "2026-11-01", criadoEm: new Date("2026-11-01T12:00:00Z") }),
    id: randomUUID(),
    empresaId: EMPRESA,
    sigla: "CAP",
    numero: "33214",
    atualizadoEm: new Date("2026-11-01T12:00:00Z"),
    ...extra,
  };
}

export class BancoFalso {
  contextos: ContextoBanco[] = [];
  ctes: CteGravado[] = [];
  ocorrencias: (OcorrenciaDoCte & { cteId: string })[] = [];
  trocas: (TrocaDePrevisao & { cteId: string })[] = [];
  contexto: CadastrosDoNucleo = {
    catalogo: CATALOGO_FR,
    filiais: [{ sigla: "CAP", cidade: "CAMPINAS", uf: "SP", propria: true }],
    regrasDePrazo: [],
    config: CONFIGURACAO_PADRAO,
    cnpjsProprios: [],
    dominioSsw: "FRT",
  };

  readonly executar: ExecutorDosJobs = async (contexto, fn) => {
    this.contextos.push(contexto);
    return fn(this.repositorios());
  };

  private repositorios(): RepositoriosDosJobs {
    return {
      agendamentos: { empresasAtivas: () => Promise.resolve([]) },
      segredos: {
        foraDaVersao: () => Promise.resolve([]),
        regravar: () => Promise.resolve(),
      },
      manutencao: {
        apagarSessoesEncerradas: () => Promise.resolve(0),
        apagarTokensDeSenhaVencidos: () => Promise.resolve(0),
      },
      recalculo: {
        propagarClassificacao: () => Promise.resolve(0),
        ctesDoCodigo: (_empresa, codigo, aposId, limite) =>
          Promise.resolve(
            this.ctes
              .filter(
                (c) =>
                  (aposId === null || c.id > aposId) &&
                  (c.ocorrEfetivaCodigoNum === codigo ||
                    this.ocorrencias.some((o) => o.cteId === c.id && o.codigo === codigo)),
              )
              .sort((a, b) => (a.id < b.id ? -1 : 1))
              .slice(0, limite),
          ),
      },
      prazos: {
        regras: () => Promise.resolve([]),
        candidatos: () => Promise.resolve([]),
        chegadas: () => Promise.resolve(new Map()),
        gravar: () => Promise.resolve(),
      },
      cteNucleo: {
        cadastrosDoNucleo: () => Promise.resolve(this.contexto),
        ocorrenciasDosCtes: (ids) =>
          Promise.resolve(
            new Map(ids.map((id) => [id, this.ocorrencias.filter((o) => o.cteId === id)])),
          ),
        atualizarCte: (id, campos) => {
          this.ctes = this.ctes.map((c) => (c.id === id ? { ...c, ...campos } : c));
          return Promise.resolve();
        },
        inserirCtes: (novos) => {
          const entraram = novos.filter(
            (n) => !this.ctes.some((c) => c.sigla === n.sigla && c.numero === n.numero),
          );
          this.ctes.push(...entraram);
          return Promise.resolve(entraram);
        },
        registrarTrocaDePrevisao: (cteId, troca) => {
          this.trocas.push({ ...troca, cteId });
          return Promise.resolve();
        },
      },
    };
  }
}
