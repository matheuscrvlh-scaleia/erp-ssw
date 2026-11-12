import { ErroDeNegocio } from "@erp/dominio/erros";
import { FUSO_DO_NEGOCIO } from "@erp/dominio/nucleo/tempo";
import { saudeDaEmpresa } from "@erp/dominio/painel-plataforma";
import {
  type ContagemPontualidade,
  montarPontualidade,
} from "@erp/dominio/performance/pontualidade";
import { statusDoSla } from "@erp/dominio/performance/tela";
import {
  type EmpresaNoPainel,
  type NivelDeSaude,
  type NumerosDaEmpresa,
  type SituacaoDoWorker,
} from "@erp/shared/contratos/painel-plataforma";
import { hojeNoFuso } from "@erp/shared/datas";

import { type ClienteWorkerSsw, MENSAGEM_WORKER_SSW_NAO_CONFIGURADO } from "../../infra/worker-ssw";
import { saudeDaIntegracao } from "../ingestao-ssw/ingestao-ssw.service";
import {
  type IndicadoresDoPeriodo,
  obterIndicadoresDoPeriodo,
} from "../performance/performance.service";
import {
  type EmpresaGravada,
  type LiberacaoGravada,
  modulosLiberados,
} from "../plataforma/plataforma.service";
import { type Executor } from "../repositorios";

/*
 * Plataforma › Dashboard: saúde e números de todas as empresas. Os dados de empresa só aparecem
 * no contexto dela (RLS), então cada empresa tem as suas transações, todas em paralelo; o que é
 * da Plataforma (empresas, vínculos, módulos, logins) sai numa transação só, agrupado por empresa.
 * As regras são as de sempre: números da Performance, saúde da SSW API da faixa, selo dos dados.
 */

export interface DependenciasPainel {
  /** Nulo = worker-ssw não configurado (a saúde diz isso; o resto segue). */
  workerSsw: ClienteWorkerSsw | null;
  agora: () => Date;
  /** Os números de uma empresa não saíram (ex.: consulta lenta): a linha segue sem eles. */
  aoFalhar: (erro: unknown, empresaId: string) => void;
}

/** Executor com a Plataforma ligada, no contexto de uma empresa (RLS) ou de nenhuma. */
export type NaEmpresa = (
  empresaId: string | null,
) => Executor<"plataforma" | "performance" | "ingestaoSsw">;

export type LinhaDoPainel = Omit<EmpresaNoPainel, "ultimoLoginEm" | "ultimoDadoEm"> & {
  ultimoLoginEm: Date | null;
  ultimoDadoEm: Date | null;
};

export interface TotaisDoPainel {
  empresas: number;
  porNivel: Record<NivelDeSaude, number>;
  usuariosAtivos: number;
  ctesNoMes: number;
  entreguesNoMes: number;
  emAtraso: number;
  /** SLA Operacional de todas as empresas juntas. */
  slaOperacional: number | null;
}

export interface PainelMontado {
  geradoEm: Date;
  /** Mês corrente até hoje (fuso do negócio). */
  periodo: { inicio: string; fim: string };
  totais: TotaisDoPainel;
  /** Da saúde mais grave à mais leve; empate pelo nome. */
  empresas: LinhaDoPainel[];
}

interface LeituraDoWorker {
  situacao: SituacaoDoWorker;
  jobsComFalha: string[];
  tokenSswGeradoEm: Date | null;
}

/** Situação da empresa no worker-ssw; fora ou sem configuração não derruba o painel. */
async function lerWorker(
  workerSsw: ClienteWorkerSsw | null,
  empresaId: string,
): Promise<LeituraDoWorker> {
  const sem = (situacao: SituacaoDoWorker) => ({
    situacao,
    jobsComFalha: [],
    tokenSswGeradoEm: null,
  });
  if (workerSsw === null) return sem("nao_configurado");
  try {
    const s = await workerSsw.situacao(empresaId);
    const jobsComFalha = s.jobs
      .filter((j) => j.ultimaExecucao?.estado === "falhou")
      .map((j) => j.job);
    return {
      situacao: jobsComFalha.length > 0 ? "com_falha" : "ok",
      jobsComFalha,
      tokenSswGeradoEm: s.tokenSswGeradoEm ? new Date(s.tokenSswGeradoEm) : null,
    };
  } catch (erro) {
    const naoConfigurado =
      erro instanceof ErroDeNegocio && erro.message === MENSAGEM_WORKER_SSW_NAO_CONFIGURADO;
    return sem(naoConfigurado ? "nao_configurado" : "fora");
  }
}

function numerosDe(i: IndicadoresDoPeriodo): NumerosDaEmpresa {
  const sla = i.pontualidade.performancePct;
  const meta = i.configuracao.slaMetaPct / 100;
  const alerta = i.configuracao.slaAlertaAmareloPct / 100;
  return {
    ctesNoMes: i.totais.totalCtrcs,
    entreguesNoMes: i.entregues,
    emAberto: i.totais.ctrcsEmAberto,
    emAtraso: i.totais.ctrcsEmAtraso,
    slaOperacional: sla,
    slaMeta: meta,
    situacaoDoSla: sla === null ? null : statusDoSla(sla, meta, alerta),
  };
}

/** As contagens da pontualidade de uma empresa, para somar todas na mesma regra da Performance. */
function contagemDaEmpresa(
  empresaId: string,
  p: IndicadoresDoPeriodo["pontualidade"],
): ContagemPontualidade {
  return {
    sigla: empresaId,
    total: p.total,
    noPrazo: p.noPrazo,
    foraPrazo: p.foraPrazo,
    semInfoBi2: p.semInfoBi2,
    excluidoCliente: p.excluidoCliente,
    noPrazoCliente: p.noPrazoCliente,
    foraPrazoCliente: p.foraPrazoCliente,
    nascidosAvaliados: p.nascidosAvaliados,
    nascidosAtraso: p.nascidosAtraso,
  };
}

interface DadosDaPlataforma {
  usuarios: Map<string, number>;
  liberacoes: LiberacaoGravada[];
  ultimoLogin: Map<string, Date>;
}

async function linhaDaEmpresa(
  naEmpresa: NaEmpresa,
  deps: DependenciasPainel,
  empresa: EmpresaGravada,
  plataforma: DadosDaPlataforma,
  periodo: { inicio: string; fim: string },
  agora: Date,
): Promise<{ linha: LinhaDoPainel; indicadores: IndicadoresDoPeriodo | null }> {
  const db = naEmpresa(empresa.id);
  const contexto = { empresaId: empresa.id, fuso: empresa.fuso };
  const [indicadores, ingestao, worker] = await Promise.all([
    obterIndicadoresDoPeriodo(db, contexto, periodo, agora).catch((erro: unknown) => {
      deps.aoFalhar(erro, empresa.id);
      return null;
    }),
    db(async ({ ingestaoSsw }) => ({
      integracao: await ingestaoSsw.integracao(empresa.id, "ssw_api"),
      ultimoDadoEm: await ingestaoSsw.ultimaAplicacao(),
      xml: await ingestaoSsw.xmlOrfaos(),
    })),
    lerWorker(deps.workerSsw, empresa.id),
  ]);
  const ssw = saudeDaIntegracao(ingestao.integracao, worker.tokenSswGeradoEm, agora);
  const ultimoLoginEm = plataforma.ultimoLogin.get(empresa.id) ?? null;
  const saude = saudeDaEmpresa({
    status: empresa.status,
    motivoDaSswApi: ssw.motivo,
    workerSsw: worker.situacao,
    jobsComFalha: worker.jobsComFalha,
    ultimoDadoEm: ingestao.ultimoDadoEm,
    xmlExpirados: ingestao.xml.expirados,
    ultimoLoginEm,
    semNumeros: indicadores === null,
    agora,
  });
  return {
    indicadores,
    linha: {
      id: empresa.id,
      nome: empresa.nome,
      nomeCurto: empresa.nomeCurto,
      status: empresa.status,
      corPrimaria: empresa.corPrimaria,
      usuariosAtivos: plataforma.usuarios.get(empresa.id) ?? 0,
      modulosLiberados: modulosLiberados(empresa, plataforma.liberacoes, agora),
      ultimoLoginEm,
      saude,
      ssw,
      workerSsw: { situacao: worker.situacao, jobsComFalha: worker.jobsComFalha },
      ultimoDadoEm: ingestao.ultimoDadoEm,
      xml: ingestao.xml,
      numeros: indicadores === null ? null : numerosDe(indicadores),
    },
  };
}

/** Do mais grave ao mais leve; empate pelo nome. */
const ORDEM_DO_NIVEL: Record<NivelDeSaude, number> = { critico: 0, atencao: 1, ok: 2, inativa: 3 };

export async function obterPainel(
  naEmpresa: NaEmpresa,
  deps: DependenciasPainel,
): Promise<PainelMontado> {
  const agora = deps.agora();
  const hoje = hojeNoFuso(FUSO_DO_NEGOCIO, agora);
  const periodo = { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };

  const { empresas, ...plataforma } = await naEmpresa(null)(async ({ plataforma: p }) => ({
    empresas: await p.empresas(),
    usuarios: await p.usuariosAtivosPorEmpresa(),
    liberacoes: await p.liberacoes(null),
    ultimoLogin: await p.ultimoLoginPorEmpresa(),
  }));
  const lidas = await Promise.all(
    empresas.map((e) => linhaDaEmpresa(naEmpresa, deps, e, plataforma, periodo, agora)),
  );

  const linhas = lidas
    .map((l) => l.linha)
    .sort(
      (a, b) =>
        ORDEM_DO_NIVEL[a.saude.nivel] - ORDEM_DO_NIVEL[b.saude.nivel] ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  const comNumeros = lidas.flatMap((l) =>
    l.indicadores ? [{ id: l.linha.id, indicadores: l.indicadores }] : [],
  );
  const somar = (campo: (n: NumerosDaEmpresa) => number) =>
    linhas.reduce((s, l) => s + (l.numeros ? campo(l.numeros) : 0), 0);
  const porNivel: Record<NivelDeSaude, number> = { ok: 0, atencao: 0, critico: 0, inativa: 0 };
  for (const l of linhas) porNivel[l.saude.nivel] += 1;

  return {
    geradoEm: agora,
    periodo,
    totais: {
      empresas: linhas.length,
      porNivel,
      usuariosAtivos: linhas.reduce((s, l) => s + l.usuariosAtivos, 0),
      ctesNoMes: somar((n) => n.ctesNoMes),
      entreguesNoMes: somar((n) => n.entreguesNoMes),
      emAtraso: somar((n) => n.emAtraso),
      slaOperacional: montarPontualidade(
        comNumeros.map((c) => contagemDaEmpresa(c.id, c.indicadores.pontualidade)),
      ).totais.performancePct,
    },
    empresas: linhas,
  };
}

/** Quanto o painel montado vale: a tela pode atualizar à vontade sem refazer as consultas. */
export const VALIDADE_DO_PAINEL_MS = 60_000;

/**
 * Cache curto do painel (é o mesmo para toda a equipe da Plataforma). Pedidos ao mesmo tempo
 * esperam a mesma montagem; se ela falhar, o próximo pedido tenta de novo.
 */
export function criarCacheDoPainel(agora: () => Date, validadeMs = VALIDADE_DO_PAINEL_MS) {
  let guardado: { ate: number; painel: Promise<PainelMontado> } | null = null;
  return (montar: () => Promise<PainelMontado>): Promise<PainelMontado> => {
    const t = agora().getTime();
    if (guardado && guardado.ate > t) return guardado.painel;
    const painel = montar();
    const este = { ate: t + validadeMs, painel };
    guardado = este;
    void painel.catch(() => {
      if (guardado === este) guardado = null;
    });
    return painel;
  };
}
