/**
 * Bonificação de entrega por colaborador e dia, a partir dos romaneios (036) e da ocorrência do
 * dia de cada CT-e.
 * origem: bonificacao_apurar (sistema atual)
 */
import { ErroDeNegocio } from "./erros";

export type EfeitoBonificacao = "penaliza" | "sac" | "verificar";

type NivelBonificacao = "turbo" | "acelerado" | "em_rota" | "sem_bonus";

type Funcao = "Motorista" | "Ajudante";

interface ParametrosBonificacao {
  taxaTurbo: number;
  taxaAcelerado: number;
  taxaEmRotaGrande: number;
  taxaEmRotaPequena: number;
  metaRotaPequena: number;
  metaRotaGrande: number;
  metaEmRota: number;
  limiteNfsRotaPequena: number;
}

interface ParametrosComVigencia extends ParametrosBonificacao {
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

/**
 * CT-e distintos de uma viagem (romaneio + placa + dia) com o mesmo código de ocorrência do dia.
 * `codigo` nulo = sem ocorrência no dia.
 */
export interface BaldeDaViagem {
  romaneio: string;
  placa: string | null;
  data: string;
  codigo: number | null;
  ctes: number;
  motorista: string | null;
  ajudante: string | null;
  ajudante2: string | null;
  ajudante3: string | null;
}

export interface HoraExtraDoDia {
  nome: string;
  data: string;
  /** Nulo = sem registro de ponto (a apuração não presume "não fez"). */
  horaExtra: boolean | null;
}

export interface Falta {
  colaboradorNome: string;
  dataFalta: string;
}

export interface LinhaBonificacao {
  dataRomaneio: string;
  unidade: string;
  romaneio: string;
  placa: string | null;
  colaborador: string;
  funcao: Funcao;
  nfsCarregadas: number;
  sac: number;
  retornos: number;
  pendentes: number;
  nfsEntregues: number;
  exito: number;
  rotaPequena: boolean;
  horaExtra: boolean | null;
  semRegistroPonto: boolean;
  nivel: NivelBonificacao;
  bonus: number;
  zeradoPorFalta: boolean;
}

/** Unidade do romaneio: as 3 primeiras letras, em maiúsculas. */
export function unidadeDoRomaneio(romaneio: string): string {
  return romaneio.slice(0, 3).toUpperCase();
}

/**
 * Parâmetros vigentes no período: os de início de vigência mais recente entre os que cobrem
 * parte do período.
 */
export function parametrosVigentes(
  linhas: readonly ParametrosComVigencia[],
  inicio: string,
  fim: string,
): ParametrosBonificacao {
  const vigente = linhas
    .filter((l) => l.vigenciaInicio <= fim && (l.vigenciaFim === null || l.vigenciaFim >= inicio))
    .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))[0];
  if (!vigente) {
    throw new ErroDeNegocio(
      "ENTRADA_INVALIDA",
      "Não há parâmetros de bonificação vigentes para o período informado. Cadastre as taxas e metas antes de apurar.",
    );
  }
  return vigente;
}

interface Viagem {
  romaneio: string;
  placa: string | null;
  data: string;
  pessoas: [string | null, Funcao][];
  carregadas: number;
  sac: number;
  retorno: number;
  pendente: number;
}

function maior(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function montarViagens(
  baldes: readonly BaldeDaViagem[],
  efeitos: ReadonlyMap<number, EfeitoBonificacao>,
): Viagem[] {
  const viagens = new Map<string, Viagem & { nomes: (string | null)[] }>();
  for (const b of baldes) {
    const chave = `${b.romaneio}|${b.placa ?? ""}|${b.data}`;
    let v = viagens.get(chave);
    if (!v) {
      v = {
        romaneio: b.romaneio,
        placa: b.placa,
        data: b.data,
        pessoas: [],
        nomes: [null, null, null, null],
        carregadas: 0,
        sac: 0,
        retorno: 0,
        pendente: 0,
      };
      viagens.set(chave, v);
    }
    const nomes = [b.motorista, b.ajudante, b.ajudante2, b.ajudante3];
    v.nomes = v.nomes.map((n, i) => maior(n, nomes[i] ?? null));
    v.carregadas += b.ctes;
    // Entregue (código 1) não entra em SAC/retorno/pendente mesmo se a tabela o classificar.
    if (b.codigo === 1) continue;
    const efeito = b.codigo === null ? null : (efeitos.get(b.codigo) ?? null);
    if (efeito === "sac") v.sac += b.ctes;
    else if (efeito === "penaliza") v.retorno += b.ctes;
    else if (efeito === null) v.pendente += b.ctes;
    // "verificar" (código 42) conta como entregue e não aparece em nenhum contador.
  }
  return [...viagens.values()].map(({ nomes, ...v }) => ({
    ...v,
    pessoas: [
      [nomes[0] ?? null, "Motorista"],
      [nomes[1] ?? null, "Ajudante"],
      [nomes[2] ?? null, "Ajudante"],
      [nomes[3] ?? null, "Ajudante"],
    ],
  }));
}

/** Êxito truncado em 2 casas (0,949 → 0,94), como a planilha. */
export function exitoDaViagem(entregues: number, base: number): number {
  return base === 0 ? 0 : Math.trunc((entregues * 100) / base) / 100;
}

function chaveDePessoa(nome: string, data: string): string {
  return `${nome.trim().toUpperCase()}|${data}`;
}

/** Taxa × NFs em décimos de milésimo (a taxa tem 4 casas): sem erro de ponto flutuante. */
function bonusDe(entregues: number, taxa: number): number {
  return (Math.round(taxa * 10_000) * entregues) / 10_000;
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Uma linha por pessoa de cada viagem, com nível e bônus. A falta zera todas as linhas da pessoa
 * no último dia bonificado antes dela.
 */
export function apurarBonificacao(entrada: {
  baldes: readonly BaldeDaViagem[];
  efeitos: ReadonlyMap<number, EfeitoBonificacao>;
  parametros: ParametrosBonificacao;
  horasExtras: readonly HoraExtraDoDia[];
  faltas: readonly Falta[];
}): LinhaBonificacao[] {
  const p = entrada.parametros;
  const horaExtra = new Map(
    entrada.horasExtras.map((h) => [chaveDePessoa(h.nome, h.data), h.horaExtra]),
  );

  const calculadas = montarViagens(entrada.baldes, entrada.efeitos).flatMap((v) =>
    v.pessoas
      .filter((pessoa): pessoa is [string, Funcao] => pessoa[0] !== null && pessoa[0].trim() !== "")
      .map(([nome, funcao]) => {
        const entregues = v.carregadas - v.sac - v.retorno;
        const exito = exitoDaViagem(entregues, v.carregadas - v.sac);
        const pequena = v.carregadas <= p.limiteNfsRotaPequena;
        const he = horaExtra.get(chaveDePessoa(nome, v.data)) ?? null;
        const meta = pequena ? p.metaRotaPequena : p.metaRotaGrande;
        const nivel: NivelBonificacao =
          exito >= meta
            ? he === false
              ? "turbo"
              : "acelerado"
            : exito >= p.metaEmRota
              ? "em_rota"
              : "sem_bonus";
        return { v, colaborador: nome.trim(), funcao, entregues, exito, pequena, he, nivel };
      }),
  );

  const zerados = new Set<string>();
  for (const falta of entrada.faltas) {
    const nome = falta.colaboradorNome.trim().toUpperCase();
    const alvo = calculadas
      .filter(
        (c) =>
          c.colaborador.toUpperCase() === nome &&
          c.v.data < falta.dataFalta &&
          c.nivel !== "sem_bonus",
      )
      .sort((a, b) => comparar(b.v.data, a.v.data))[0];
    if (alvo) zerados.add(`${alvo.colaborador}|${alvo.v.data}`);
  }

  const taxa = (c: (typeof calculadas)[number]): number => {
    if (c.nivel === "turbo") return p.taxaTurbo;
    if (c.nivel === "acelerado") return p.taxaAcelerado;
    if (c.nivel === "em_rota") return c.pequena ? p.taxaEmRotaPequena : p.taxaEmRotaGrande;
    return 0;
  };

  return calculadas
    .map((c): LinhaBonificacao => {
      const zerado = zerados.has(`${c.colaborador}|${c.v.data}`);
      return {
        dataRomaneio: c.v.data,
        unidade: unidadeDoRomaneio(c.v.romaneio),
        romaneio: c.v.romaneio,
        placa: c.v.placa,
        colaborador: c.colaborador,
        funcao: c.funcao,
        nfsCarregadas: c.v.carregadas,
        sac: c.v.sac,
        retornos: c.v.retorno,
        pendentes: c.v.pendente,
        nfsEntregues: c.entregues,
        exito: c.exito,
        rotaPequena: c.pequena,
        horaExtra: c.he,
        semRegistroPonto: c.he === null,
        nivel: c.nivel,
        bonus: zerado ? 0 : bonusDe(c.entregues, taxa(c)),
        zeradoPorFalta: zerado,
      };
    })
    .sort(
      (a, b) =>
        comparar(a.dataRomaneio, b.dataRomaneio) ||
        comparar(a.romaneio, b.romaneio) ||
        Number(a.funcao !== "Motorista") - Number(b.funcao !== "Motorista") ||
        comparar(a.colaborador, b.colaborador),
    );
}

export interface ResumoPessoa {
  colaborador: string;
  /** "Motorista", "Ajudante" ou "Motorista/Ajudante" se variou no período. */
  funcao: string;
  dias: number;
  entregues: number;
  retornos: number;
  exitoMedio: number;
  diasTurbo: number;
  diasSemBonus: number;
  diasHoraExtra: number;
  semPonto: number;
  zerados: number;
  total: number;
  linhas: LinhaBonificacao[];
}

/**
 * Resumo da tela por colaborador. Êxito médio = média simples dos êxitos diários (um dia de 2
 * NFs pesa igual a um de 40), como a planilha.
 * origem: agruparPorPessoa (BonificacaoScreen.tsx)
 */
export function agruparPorPessoa(linhas: readonly LinhaBonificacao[]): ResumoPessoa[] {
  const porPessoa = new Map<string, LinhaBonificacao[]>();
  for (const l of linhas) {
    const atual = porPessoa.get(l.colaborador);
    if (atual) atual.push(l);
    else porPessoa.set(l.colaborador, [l]);
  }
  return [...porPessoa.entries()]
    .map(([colaborador, ls]) => ({
      colaborador,
      funcao: [...new Set(ls.map((l) => l.funcao))].sort().reverse().join("/"),
      dias: ls.length,
      entregues: ls.reduce((a, l) => a + l.nfsEntregues, 0),
      retornos: ls.reduce((a, l) => a + l.retornos, 0),
      exitoMedio: ls.reduce((a, l) => a + l.exito, 0) / ls.length,
      diasTurbo: ls.filter((l) => l.nivel === "turbo").length,
      diasSemBonus: ls.filter((l) => l.nivel === "sem_bonus").length,
      diasHoraExtra: ls.filter((l) => l.horaExtra === true).length,
      semPonto: ls.filter((l) => l.semRegistroPonto).length,
      zerados: ls.filter((l) => l.zeradoPorFalta).length,
      total: ls.reduce((a, l) => a + Math.round(l.bonus * 10_000), 0) / 10_000,
      linhas: [...ls].sort((a, b) => comparar(a.dataRomaneio, b.dataRomaneio)),
    }))
    .sort((a, b) => b.total - a.total);
}
