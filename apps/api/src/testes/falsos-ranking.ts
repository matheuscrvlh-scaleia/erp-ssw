import { randomUUID } from "node:crypto";

import { type BaldeDaViagem, type EfeitoBonificacao } from "@erp/dominio/bonificacao-entrega";
import { type BaldeRanking, type RotuloRanking } from "@erp/dominio/ranking";
import { type TotaisDaEquipe } from "@erp/dominio/ranking-equipes";
import {
  type Falta,
  type ParametrosDeBonificacao,
} from "@erp/shared/contratos/bonificacao-entrega";
import { type Regra } from "@erp/shared/contratos/ranking";

import { type IntegracaoAhgora, type RepositorioAhgora } from "../modulos/ahgora/casos-de-uso";
import { type RepositorioBonificacaoEntrega } from "../modulos/bonificacao-entrega/casos-de-uso";
import {
  type EquipeGravada,
  type MembroGravado,
  type RepositorioRanking,
} from "../modulos/ranking/casos-de-uso";
import { type FiltroPerformance } from "../modulos/ranking/filtro-performance";

/*
 * Dados falsos de Ranking, Bonificação de entrega e Ahgora para os testes: arrays por empresa e
 * os repositórios sobre eles. Não simula SQL: as consultas agregadas (baldes, totais) devolvem o
 * que o teste preparou e guardam o filtro recebido para conferência.
 */

interface CteFalso {
  id: string;
  empresaId: string;
  sigla: string;
  numero: string;
  dataEmissao: string;
  equipeId: string | null;
  unidadeId: string | null;
  foraUniverso: boolean;
}

const resolver = <T>(valor: T) => Promise.resolve(valor);

export class DadosDoRanking {
  filiaisProprias = new Map<string, string[]>();
  codigosBaixa: number[] = [12, 36, 61, 77, 92, 93, 94, 99];
  baldesRanking: BaldeRanking[] = [];
  rotulosRanking: RotuloRanking[] = [];
  filtrosRecebidos: FiltroPerformance[] = [];
  /** Erros que as próximas consultas do ranking operacional lançam (um por consulta). */
  falhasDoRanking: Error[] = [];

  equipes: (EquipeGravada & { empresaId: string })[] = [];
  membros: (MembroGravado & { empresaId: string })[] = [];
  unidades: { id: string; nome: string; empresaId: string }[] = [];
  ctes: CteFalso[] = [];
  regras: (Regra & { empresaId: string })[] = [];
  totais = new Map<string, TotaisDaEquipe>();

  parametros: (ParametrosDeBonificacao & { empresaId: string })[] = [];
  baldesBonificacao: BaldeDaViagem[] = [];
  colaboradores: string[] = [];
  efeitos: { codigo: number; efeito: EfeitoBonificacao }[] = [];
  faltas: (Falta & { empresaId: string })[] = [];

  integracoes = new Map<string, IntegracaoAhgora>();

  repositorios(): {
    ranking: RepositorioRanking;
    bonificacaoEntrega: RepositorioBonificacaoEntrega;
    ahgora: RepositorioAhgora;
  } {
    return {
      ranking: this.ranking(),
      bonificacaoEntrega: this.bonificacao(),
      ahgora: { integracao: (empresaId) => resolver(this.integracoes.get(empresaId) ?? null) },
    };
  }

  private ranking(): RepositorioRanking {
    const semEmpresa = <T extends { empresaId: string }>({ empresaId: _e, ...resto }: T) => resto;
    const regrasDa = (empresaId: string) =>
      this.regras.filter((r) => r.empresaId === empresaId).map(semEmpresa);
    return {
      filiaisProprias: (empresaId) => resolver(this.filiaisProprias.get(empresaId) ?? []),
      codigosBaixa: () => resolver(this.codigosBaixa),
      baldes: (filtro) => {
        this.filtrosRecebidos.push(filtro);
        const falha = this.falhasDoRanking.shift();
        return falha === undefined ? resolver(this.baldesRanking) : Promise.reject(falha);
      },
      rotulos: () => resolver(this.rotulosRanking),

      equipes: (empresaId) =>
        resolver(this.equipes.filter((e) => e.empresaId === empresaId).map(semEmpresa)),
      equipe: (empresaId, id) => {
        const e = this.equipes.find((x) => x.empresaId === empresaId && x.id === id);
        return resolver(e ? semEmpresa(e) : null);
      },
      membrosAtivos: (empresaId) =>
        resolver(
          this.membros
            .filter((m) => m.empresaId === empresaId && m.dataSaida === null)
            .map(semEmpresa),
        ),
      membro: (empresaId, id) => {
        const m = this.membros.find((x) => x.empresaId === empresaId && x.id === id);
        return resolver(m ? semEmpresa(m) : null);
      },
      unidades: (empresaId) =>
        resolver(this.unidades.filter((u) => u.empresaId === empresaId).map(semEmpresa)),
      inserirEquipe: (empresaId, dados) => {
        const id = randomUUID();
        this.equipes.push({
          id,
          empresaId,
          ...dados,
          tokenPublicoHash: null,
          tokenPublicoRevogado: false,
        });
        return resolver(id);
      },
      alterarEquipe: (id, dados) => {
        this.equipes = this.equipes.map((e) => (e.id === id ? { ...e, ...dados } : e));
        return resolver(undefined);
      },
      inserirMembro: (empresaId, dados) => {
        this.membros.push({ id: randomUUID(), empresaId, dataSaida: null, ...dados });
        return resolver(undefined);
      },
      encerrarMembro: (id, dataSaida) => {
        this.membros = this.membros.map((m) => (m.id === id ? { ...m, dataSaida } : m));
        return resolver(undefined);
      },
      gravarLink: (equipeId, link) => {
        this.equipes = this.equipes.map((e) =>
          e.id === equipeId
            ? { ...e, tokenPublicoHash: link.hash, tokenPublicoRevogado: link.revogado }
            : e,
        );
        return resolver(undefined);
      },
      ctesParaAtribuir: (empresaId, f) =>
        resolver(
          this.ctes
            .filter(
              (c) =>
                c.empresaId === empresaId &&
                !c.foraUniverso &&
                c.dataEmissao >= f.inicio &&
                c.dataEmissao <= f.fim &&
                (!f.somenteSemEquipe || c.equipeId === null) &&
                (f.unidadeId === null || c.unidadeId === f.unidadeId),
            )
            .map((c) => ({
              id: c.id,
              sigla: c.sigla,
              numero: c.numero,
              dataEmissao: c.dataEmissao,
              cidadeDestino: null,
              ufDestino: null,
              motoristaNome: null,
            })),
        ),
      atribuirEquipe: (empresaId, cteIds, equipeId) => {
        let quantidade = 0;
        for (const c of this.ctes) {
          if (c.empresaId === empresaId && cteIds.includes(c.id)) {
            c.equipeId = equipeId;
            quantidade++;
          }
        }
        return resolver(quantidade);
      },

      regras: (empresaId) => resolver(regrasDa(empresaId)),
      regra: (empresaId, id) => resolver(regrasDa(empresaId).find((r) => r.id === id) ?? null),
      inserirRegra: (empresaId, dados) => {
        const id = randomUUID();
        this.regras.push({ id, empresaId, ...dados, criterios: [] });
        return resolver(id);
      },
      alterarRegra: (id, dados) => {
        this.regras = this.regras.map((r) => (r.id === id ? { ...r, ...dados } : r));
        return resolver(undefined);
      },
      substituirCriterios: (_empresaId, regraId, criterios) => {
        this.regras = this.regras.map((r) =>
          r.id === regraId
            ? {
                ...r,
                criterios: criterios.map((c, ordem) => ({ id: randomUUID(), ordem, ...c })),
              }
            : r,
        );
        return resolver(undefined);
      },
      excluirRegra: (id) => {
        this.regras = this.regras.filter((r) => r.id !== id);
        return resolver(undefined);
      },
      totaisPorEquipe: (_empresaId, equipeIds) =>
        resolver(new Map([...this.totais].filter(([equipeId]) => equipeIds.includes(equipeId)))),
      equipePorToken: (hash) => {
        const e = this.equipes.find((x) => x.tokenPublicoHash === hash && !x.tokenPublicoRevogado);
        return resolver(e ? { id: e.id, empresaId: e.empresaId } : null);
      },
    };
  }

  private bonificacao(): RepositorioBonificacaoEntrega {
    return {
      unidades: () => resolver([]),
      parametros: (empresaId) =>
        resolver(
          this.parametros
            .filter((p) => p.empresaId === empresaId)
            .map(({ empresaId: _e, ...p }) => p),
        ),
      colaboradores: () => resolver(this.colaboradores),
      baldes: () => resolver(this.baldesBonificacao),
      efeitos: () => resolver(this.efeitos),
      todasAsFaltas: (empresaId) => resolver(this.faltas.filter((f) => f.empresaId === empresaId)),
      faltas: (empresaId, inicio, fim) =>
        resolver(
          this.faltas
            .filter((f) => f.empresaId === empresaId && f.dataFalta >= inicio && f.dataFalta <= fim)
            .map(({ empresaId: _e, ...f }) => f),
        ),
      falta: (empresaId, id) => {
        const f = this.faltas.find((x) => x.empresaId === empresaId && x.id === id);
        return resolver(f ? { ...f } : null);
      },
      gravarFalta: (empresaId, dados) => {
        const existente = this.faltas.find(
          (f) =>
            f.empresaId === empresaId &&
            f.colaboradorNome === dados.colaboradorNome &&
            f.dataFalta === dados.dataFalta,
        );
        if (existente) {
          Object.assign(existente, dados);
          return resolver(existente.id);
        }
        const id = randomUUID();
        this.faltas.push({ id, empresaId, ...dados });
        return resolver(id);
      },
      excluirFalta: (id) => {
        this.faltas = this.faltas.filter((f) => f.id !== id);
        return resolver(undefined);
      },
    };
  }
}
