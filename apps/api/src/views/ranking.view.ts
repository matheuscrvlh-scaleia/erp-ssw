import { compararMembros } from "@erp/domain/team-ranking";
import { type SaidaDe } from "@erp/shared/contract";
import {
  type CalculoDaEquipe,
  type contratosRanking,
  type Equipe,
  type Membro,
} from "@erp/shared/contracts/ranking";

import {
  type CalculoNoLote,
  type CteParaAtribuir,
  type EquipeComLink,
  type EquipesDaEmpresa,
  type LoteDaRegra,
  type MembroGravado,
  type RankingDaEquipe,
} from "../models/ranking/ranking.service";

type Saida<K extends keyof typeof contratosRanking> = SaidaDe<(typeof contratosRanking)[K]>;

/** A equipe como a tela vê: o hash do token do link fica no servidor. */
function apresentarEquipe(e: EquipeComLink): Equipe {
  return { id: e.id, nome: e.nome, unidadeId: e.unidadeId, ativo: e.ativo, linkAtivo: e.linkAtivo };
}

/** Membros como a tela lista: motorista primeiro, ajudantes pela posição, depois o nome. */
const emOrdemDeExibicao = (membros: readonly MembroGravado[]) => [...membros].sort(compararMembros);

function apresentarMembro({ dataSaida: _dataSaida, ...membro }: MembroGravado): Membro {
  return membro;
}

export function apresentarEquipes({
  equipes,
  membros,
  unidades,
}: EquipesDaEmpresa): Saida<"equipes"> {
  return {
    equipes: equipes.map(apresentarEquipe),
    membros: emOrdemDeExibicao(membros).map(apresentarMembro),
    unidades,
  };
}

export function apresentarCtesParaAtribuir(ctes: CteParaAtribuir[]): Saida<"ctesParaAtribuir"> {
  return { ctes };
}

export function apresentarSimulacao(lote: LoteDaRegra): Saida<"simularRegra"> {
  return {
    ...lote,
    equipes: lote.equipes.map((e) => ({
      ...e,
      membros: emOrdemDeExibicao(e.membros).map((m) => ({ nome: m.nome, papel: m.papel })),
    })),
  };
}

/** Só o cálculo: nome, unidade e membros da equipe não vão no bloco do cálculo. */
function soOCalculo({
  nome: _nome,
  unidadeId: _unidadeId,
  unidadeNome: _unidadeNome,
  membros: _membros,
  ...calculo
}: CalculoNoLote): CalculoDaEquipe {
  return calculo;
}

/** O link público mostra da equipe só o id e o nome. */
export function apresentarRankingPublico(r: RankingDaEquipe): Saida<"publico"> {
  return {
    equipe: { id: r.equipe.id, nome: r.equipe.nome },
    periodo: r.periodo,
    calculo: soOCalculo(r.calculo),
    posicao: r.posicao,
    totalEquipes: r.totalEquipes,
    top3: r.top3,
  };
}
