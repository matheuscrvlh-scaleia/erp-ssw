/**
 * Casos de uso da tela Prazo do parceiro. O repositório traz os CT-e do período com os filtros
 * (set-based); totais, ranking e histograma são do `@erp/dominio/prazo-parceiro`.
 * Spec: docs/regras/03-romaneio-prazo-parceiro.md §6.
 */
import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  comparacaoComAnterior,
  diasAbaixoDoPadrao,
  type FatoPrazo,
  fatosDoParceiro,
  histogramaDeAtraso,
  nasceuAtrasado,
  nomeDoCte,
  type ParceiroCadastrado,
  type Periodo,
  periodoAnterior,
  PREFIXO_CNPJ,
  rankingDoPrazo,
  totaisDoPrazo,
} from "@erp/dominio/prazo-parceiro/prazo-parceiro";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosPrazoParceiro,
  type FiltroDaLista,
  type FiltrosPrazo,
  LIMITE_EXPORTACAO_PRAZO,
  LIMITE_NASCIDOS_DETALHE,
  type LinhaPrazo,
} from "@erp/shared/contratos/prazo-parceiro";

import { type Executor } from "../../repositorios";

type Saida<K extends keyof typeof contratosPrazoParceiro> = SaidaDe<
  (typeof contratosPrazoParceiro)[K]
>;

// ---------------------------------------------------------------------------------------------
// Porta do repositório

/** CT-e do período, com o que lista e detalhe mostram. */
export interface FatoDoPrazo extends FatoPrazo {
  id: string;
  sigla: string;
  numero: string;
  dataEmissao: string;
  dataEmbarque: string | null;
  statusAtual: string | null;
  setor: string | null;
  /** Filial do CT-e, senão o nome da unidade. */
  unidadeNome: string | null;
  cidadeDestino: string | null;
  ufDestino: string | null;
}

/** Universo do Prazo do parceiro + filtros da tela, já normalizados. */
export interface ConsultaPrazo {
  periodo: Periodo;
  filiaisProprias: readonly string[];
  unidades: readonly string[] | null;
  /** parceiro_id do CT-e. */
  parceiros: readonly string[] | null;
  /** Em maiúsculas; `__SEM_TIPO__` = sem tipo. */
  tipos: readonly string[] | null;
  /** Detalhe: só CT-e destes cadastros ou deste CNPJ (o recorte exato é do domínio). */
  doParceiro: { ids: readonly string[]; cnpj: string | null } | null;
}

export interface CadastroDeParceiro extends ParceiroCadastrado {
  prazoAcordoHoras: number;
  ativo: boolean;
}

export interface RepositorioPrazoParceiro {
  filiaisProprias(): Promise<string[]>;
  /** Valor por chave: o da empresa, senão o da plataforma. */
  configuracoes(chaves: readonly string[]): Promise<Map<string, string>>;
  parceiros(): Promise<CadastroDeParceiro[]>;
  unidadesAtivas(): Promise<{ id: string; nome: string }[]>;
  fatos(consulta: ConsultaPrazo): Promise<FatoDoPrazo[]>;
  /** Página da lista, filtrada e ordenada no banco (embarque mais recente primeiro). */
  lista(
    consulta: ConsultaPrazo,
    filtro: FiltroDaLista,
    pagina: { inicio: number; quantos: number },
  ): Promise<FatoDoPrazo[]>;
  contarLista(consulta: ConsultaPrazo, filtro: FiltroDaLista): Promise<number>;
}

type Db = Executor<"prazoParceiro">;

// ---------------------------------------------------------------------------------------------
// Regras comuns

const digitos = (cnpj: string | null) => cnpj?.replace(/\D/g, "") || null;

/** Nulo = sem filiais próprias: nenhuma linha. */
function consultaDe(
  f: FiltrosPrazo,
  filiaisProprias: readonly string[],
  doParceiro: ConsultaPrazo["doParceiro"] = null,
): ConsultaPrazo | null {
  if (filiaisProprias.length === 0) return null;
  const naoVazio = <T>(l: readonly T[] | undefined) => (l && l.length > 0 ? l : null);
  return {
    periodo: { inicio: f.inicio, fim: f.fim },
    filiaisProprias,
    unidades: naoVazio(f.unidades),
    parceiros: naoVazio(f.parceiros),
    tipos: naoVazio(f.tipos?.map((t) => t.trim().toUpperCase())),
    doParceiro,
  };
}

/** Meta e alerta do SLA da empresa, em fração (configuração em %; padrão 95/90). */
async function slaDa(repo: RepositorioPrazoParceiro) {
  const config = await repo.configuracoes(["sla_meta_pct", "sla_alerta_amarelo_pct"]);
  const fracao = (chave: string, padrao: number) => {
    const n = Number(config.get(chave));
    return (config.get(chave)?.trim() && Number.isFinite(n) ? n : padrao) / 100;
  };
  return { meta: fracao("sla_meta_pct", 95), alerta: fracao("sla_alerta_amarelo_pct", 90) };
}

const TOTAIS_VAZIOS = totaisDoPrazo([]);

// ---------------------------------------------------------------------------------------------
// Casos de uso

/** Cards, comparação com o período anterior e ranking. origem: calcular_prazo_parceiro */
export async function obterVisaoGeral(db: Db, f: FiltrosPrazo): Promise<Saida<"visaoGeral">> {
  return db(async ({ prazoParceiro: repo }) => {
    const [proprias, cadastros, sla] = await Promise.all([
      repo.filiaisProprias(),
      repo.parceiros(),
      slaDa(repo),
    ]);
    const consulta = consultaDe(f, proprias);
    if (!consulta) {
      return {
        totais: TOTAIS_VAZIOS,
        comparacao: comparacaoComAnterior(TOTAIS_VAZIOS, []),
        ranking: [],
        sla,
      };
    }
    const atual = await repo.fatos(consulta);
    const anterior = await repo.fatos({ ...consulta, periodo: periodoAnterior(consulta.periodo) });
    const totais = totaisDoPrazo(atual);
    return {
      totais,
      comparacao: comparacaoComAnterior(totais, anterior),
      ranking: rankingDoPrazo(atual, cadastros),
      sla,
    };
  });
}

/** Opções dos filtros: unidades e parceiros ativos, por nome. */
export async function obterOpcoes(db: Db): Promise<Saida<"opcoes">> {
  return db(async ({ prazoParceiro: repo }) => {
    const [unidades, parceiros] = await Promise.all([repo.unidadesAtivas(), repo.parceiros()]);
    return {
      unidades,
      parceiros: parceiros
        .filter((p) => p.ativo)
        .map(({ id, nome }) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  });
}

function linhaDaLista(c: FatoDoPrazo): LinhaPrazo {
  return {
    id: c.id,
    sigla: c.sigla,
    numero: c.numero,
    parceiroNome: c.parceiroNome,
    dataEmbarque: c.dataEmbarque,
    dataPrevista: c.dataPrevista,
    prazoPadraoData: c.prazoPadraoData,
    diasAbaixoDoPadrao: diasAbaixoDoPadrao(c),
    nasceuAtrasado: nasceuAtrasado(c),
    prazoOrigem: c.prazoOrigem,
    statusAtual: c.statusAtual,
    setor: c.setor,
    unidadeNome: c.unidadeNome,
  };
}

/**
 * Lista do rodapé: mesmo universo dos cards (Q13), filtrada, ordenada e paginada no banco (Q04).
 * origem: getPrazoParceiroLista (sistema atual)
 */
export async function obterLista(
  db: Db,
  e: { filtros: FiltrosPrazo; filtro: FiltroDaLista; pagina: number; tamanho: number },
): Promise<Saida<"lista">> {
  return db(async ({ prazoParceiro: repo }) => {
    const consulta = consultaDe(e.filtros, await repo.filiaisProprias());
    if (!consulta) return { linhas: [], total: 0 };
    const [linhas, total] = await Promise.all([
      repo.lista(consulta, e.filtro, { inicio: (e.pagina - 1) * e.tamanho, quantos: e.tamanho }),
      repo.contarLista(consulta, e.filtro),
    ]);
    return { linhas: linhas.map(linhaDaLista), total };
  });
}

/** Exportação da lista, até 20.000 linhas; `truncada` quando passou disso. */
export async function exportarLista(
  db: Db,
  e: { filtros: FiltrosPrazo; filtro: FiltroDaLista },
): Promise<Saida<"exportar">> {
  return db(async ({ prazoParceiro: repo }) => {
    const consulta = consultaDe(e.filtros, await repo.filiaisProprias());
    if (!consulta) return { linhas: [], truncada: false };
    const linhas = await repo.lista(consulta, e.filtro, {
      inicio: 0,
      quantos: LIMITE_EXPORTACAO_PRAZO + 1,
    });
    return {
      linhas: linhas.slice(0, LIMITE_EXPORTACAO_PRAZO).map(linhaDaLista),
      truncada: linhas.length > LIMITE_EXPORTACAO_PRAZO,
    };
  });
}

/** CT-e que o ranking contou para este id (cadastro ou `cnpj:`). */
function alvoDoDetalhe(id: string, cadastros: readonly CadastroDeParceiro[]) {
  if (id.startsWith(PREFIXO_CNPJ)) {
    const cnpj = id.slice(PREFIXO_CNPJ.length);
    return { cadastro: undefined, cnpj, ids: cadastros.filter((p) => digitos(p.cnpj) === cnpj) };
  }
  const cadastro = cadastros.find((p) => p.id === id);
  if (!cadastro) {
    throw new ErroDeNegocio("NAO_ENCONTRADO", "Parceiro não encontrado. Volte e abra pela lista.");
  }
  const cnpj = digitos(cadastro.cnpj);
  return {
    cadastro,
    cnpj,
    ids: cnpj ? cadastros.filter((p) => digitos(p.cnpj) === cnpj) : [cadastro],
  };
}

/**
 * Detalhe do parceiro: os CT-e da linha do ranking (Q08), resumo, histograma e nascidos em
 * atraso (emissão mais recente primeiro, até 500). origem: calcular_prazo_parceiro_detalhe
 */
export async function obterDetalhe(db: Db, id: string, f: FiltrosPrazo): Promise<Saida<"detalhe">> {
  return db(async ({ prazoParceiro: repo }) => {
    const [proprias, cadastros, sla] = await Promise.all([
      repo.filiaisProprias(),
      repo.parceiros(),
      slaDa(repo),
    ]);
    const alvo = alvoDoDetalhe(id, cadastros);
    const consulta = consultaDe(f, proprias, {
      ids: alvo.ids.map((p) => p.id),
      cnpj: alvo.cnpj,
    });
    const candidatos = consulta ? await repo.fatos(consulta) : [];
    const { itens } = fatosDoParceiro(candidatos, cadastros, id);
    const nascidos = itens
      .filter(nasceuAtrasado)
      .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao) || a.id.localeCompare(b.id))
      .slice(0, LIMITE_NASCIDOS_DETALHE);
    return {
      parceiro: {
        nome: alvo.cadastro?.nome ?? nomeDoCte(itens) ?? alvo.cnpj ?? "— sem nome —",
        prazoAcordoHoras: alvo.cadastro?.prazoAcordoHoras ?? null,
      },
      resumo: totaisDoPrazo(itens),
      histograma: histogramaDeAtraso(itens),
      nascidos: nascidos.map((c) => ({
        id: c.id,
        sigla: c.sigla,
        numero: c.numero,
        dataEmbarque: c.dataEmbarque,
        dataEmissao: c.dataEmissao,
        dataPrevista: c.dataPrevista,
        prazoPadraoData: c.prazoPadraoData,
        diasAbaixoDoPadrao: diasAbaixoDoPadrao(c),
        statusAtual: c.statusAtual,
        setor: c.setor,
        unidadeNome: c.unidadeNome,
        cidadeDestino: c.cidadeDestino,
        ufDestino: c.ufDestino,
      })),
      sla,
    };
  });
}
