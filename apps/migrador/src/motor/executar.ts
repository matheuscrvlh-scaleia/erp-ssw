import { type PgTable } from "drizzle-orm/pg-core";

import { type ArmazemDeEstado, type EstadoDaTabela, type EstadoDoMigrador } from "./estado";
import { type Infra, type Log } from "./infra";
import { type Conferencia, conferirTabela, migrarTabela } from "./motor";
import { type DefinicaoDeTabela, type Filtros, type Passo } from "./tipos";

export interface OpcoesDaExecucao {
  simulacao: boolean;
  recomecar: boolean;
  tamanhoDoLote: number;
  /** `--tabelas`: nomes de passo ou de tabela de destino; nulo = todas. */
  tabelas: readonly string[] | null;
  empresaId: string | null;
}

/** Passo sem definição de tabela: entra no relatório como pendência ou como feito. */
export interface PassoFinal {
  nome: string;
  executar: (infra: Infra, filtros: Filtros, simulacao: boolean) => Promise<string[]>;
}

export interface RelatorioDaTabela {
  nome: string;
  origem: string;
  destino: string;
  /** Já estava concluída no checkpoint (não foi relida nesta execução). */
  retomadaConcluida: boolean;
  estado: EstadoDaTabela;
  conferencia: Conferencia | null;
  notas: string[];
}

export interface Relatorio {
  iniciadoEm: string;
  finalizadoEm: string;
  simulacao: boolean;
  empresaId: string | null;
  instante: string;
  tabelas: RelatorioDaTabela[];
  passosFinais: { nome: string; notas: string[] }[];
  sucesso: boolean;
}

export function selecionarPassos(
  passos: readonly Passo[],
  tabelas: readonly string[] | null,
): Passo[] {
  if (tabelas === null) return [...passos];
  const desconhecidas = tabelas.filter((t) => !passos.some((p) => p.nome === t || p.destino === t));
  if (desconhecidas.length > 0) {
    throw new Error(`Tabela desconhecida em --tabelas: ${desconhecidas.join(", ")}.`);
  }
  return passos.filter((p) => tabelas.includes(p.nome) || tabelas.includes(p.destino));
}

async function estadoDeInicio(
  armazem: ArmazemDeEstado,
  opcoes: OpcoesDaExecucao,
  instanteDoBanco: () => Promise<string>,
): Promise<EstadoDoMigrador> {
  const salvo = opcoes.recomecar || opcoes.simulacao ? null : await armazem.ler();
  if (salvo && salvo.empresaId !== opcoes.empresaId) {
    throw new Error(
      "O checkpoint é de outra execução (--empresa diferente). Rode com --recomecar para começar de novo.",
    );
  }
  return (
    salvo ?? {
      versao: 1,
      instante: await instanteDoBanco(),
      empresaId: opcoes.empresaId,
      tabelas: {},
    }
  );
}

/**
 * Ordem: migra os passos na ordem do registro (dependências primeiro), roda os ajustes
 * adiados (`aposMigrar`), os passos finais (projeções, recálculo) e, por fim, a conferência
 * origem × destino de cada tabela. Uma tabela que falha para a execução (simulação não para).
 */
export async function executarMigracao(
  passos: readonly Passo[],
  finais: readonly PassoFinal[],
  infra: Infra,
  armazem: ArmazemDeEstado,
  opcoes: OpcoesDaExecucao,
  log: Log,
  instanteDoBanco: () => Promise<string>,
  agora: () => Date = () => new Date(),
): Promise<Relatorio> {
  const iniciadoEm = agora().toISOString();
  const selecionados = selecionarPassos(passos, opcoes.tabelas);
  const estado = await estadoDeInicio(armazem, opcoes, instanteDoBanco);
  const filtros: Filtros = { empresaId: opcoes.empresaId, instante: estado.instante };
  const relatorios = new Map<string, RelatorioDaTabela>();
  // Objeto (não `let`): é alterado dentro dos visitantes assíncronos.
  const situacao = { falhou: false };

  for (const passo of selecionados) {
    const anterior = estado.tabelas[passo.nome];
    await passo.aplicar({
      executar: async <O extends object, T extends PgTable, A>(def: DefinicaoDeTabela<O, T, A>) => {
        log.info({ tabela: def.nome }, "migrando");
        const resultado = await migrarTabela(
          def,
          infra,
          filtros,
          opcoes,
          anterior,
          async (novo) => {
            estado.tabelas[def.nome] = novo;
            await armazem.salvar(estado);
          },
          log,
        );
        relatorios.set(def.nome, {
          nome: def.nome,
          origem: def.origem,
          destino: passo.destino,
          retomadaConcluida: anterior?.status === "concluida",
          estado: resultado,
          conferencia: null,
          notas: [],
        });
        if (resultado.status === "falhou") situacao.falhou = true;
      },
    });
    if (situacao.falhou && !opcoes.simulacao) break;
  }

  const passosFinais: Relatorio["passosFinais"] = [];
  if (!situacao.falhou && !opcoes.simulacao) {
    for (const passo of selecionados) {
      await passo.aplicar({
        executar: async <O extends object, T extends PgTable, A>(
          def: DefinicaoDeTabela<O, T, A>,
        ) => {
          if (!def.aposMigrar) return;
          const notas = await def.aposMigrar({ ...infra, executor: infra.destino }, filtros);
          relatorios.get(def.nome)?.notas.push(...notas);
        },
      });
    }
  }
  if (!situacao.falhou) {
    for (const final of finais) {
      passosFinais.push({
        nome: final.nome,
        notas: await final.executar(infra, filtros, opcoes.simulacao),
      });
    }
  }
  if (!situacao.falhou && !opcoes.simulacao) {
    for (const passo of selecionados) {
      await passo.aplicar({
        executar: async <O extends object, T extends PgTable, A>(
          def: DefinicaoDeTabela<O, T, A>,
        ) => {
          log.info({ tabela: def.nome }, "conferindo");
          const conferencia = await conferirTabela(def, infra, filtros, opcoes.tamanhoDoLote);
          const relatorio = relatorios.get(def.nome);
          if (relatorio) relatorio.conferencia = conferencia;
          if (!conferencia.confere) {
            situacao.falhou = true;
            log.warn({ tabela: def.nome, ...conferencia }, "conferência não bate");
          }
        },
      });
    }
  }

  const tabelas = [...relatorios.values()];
  const comErro = tabelas.some((t) => t.estado.status === "falhou");
  return {
    iniciadoEm,
    finalizadoEm: agora().toISOString(),
    simulacao: opcoes.simulacao,
    empresaId: opcoes.empresaId,
    instante: estado.instante,
    tabelas,
    passosFinais,
    sucesso: !situacao.falhou && !comErro,
  };
}
