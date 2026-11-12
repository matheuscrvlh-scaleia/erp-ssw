import { ErroDeNegocio } from "@erp/dominio/erros";
import { FUSO_DO_NEGOCIO } from "@erp/dominio/nucleo/tempo";
import { saudeDaEmpresa, ultimosMeses } from "@erp/dominio/painel-plataforma";
import {
  type EmpresaNoPainel,
  type NivelDeSaude,
  type PainelPlataforma,
  type SituacaoDoWorker,
} from "@erp/shared/contratos/painel-plataforma";
import { hojeNoFuso } from "@erp/shared/datas";
import { type StatusEmpresa, type TipoIntegracao, TIPOS_INTEGRACAO } from "@erp/shared/plataforma";

import { type ClienteWorkerSsw, MENSAGEM_WORKER_SSW_NAO_CONFIGURADO } from "../../infra/worker-ssw";
import { saudeDaIntegracao } from "../ingestao-ssw/ingestao-ssw.service";
import {
  type EmpresaGravada,
  type LiberacaoGravada,
  modulosLiberados,
} from "../plataforma/plataforma.service";
import { type Executor } from "../repositorios";

/*
 * Plataforma › Dashboard: a Plataforma como um todo — quantas empresas, como crescem, as
 * integrações e o uso. Os dados de empresa só aparecem no contexto dela (RLS), então cada empresa
 * tem as suas transações, todas em paralelo; o que é da Plataforma (empresas, vínculos, módulos,
 * integrações, logins) sai numa transação só, agrupado por empresa.
 */

interface DependenciasPainel {
  /** Nulo = worker-ssw não configurado (a saúde diz isso; o resto segue). */
  workerSsw: ClienteWorkerSsw | null;
  agora: () => Date;
  /** A contagem dos CT-e de uma empresa não saiu (ex.: consulta lenta): a linha segue sem ela. */
  aoFalhar: (erro: unknown, empresaId: string) => void;
}

/** Executor com a Plataforma ligada, no contexto de uma empresa (RLS) ou de nenhuma. */
type NaEmpresa = (empresaId: string | null) => Executor<"plataforma" | "ingestaoSsw">;

export type LinhaDoPainel = Omit<EmpresaNoPainel, "criadaEm" | "ultimoLoginEm" | "ultimoDadoEm"> & {
  criadaEm: Date;
  ultimoLoginEm: Date | null;
  ultimoDadoEm: Date | null;
};

export type PainelMontado = Omit<PainelPlataforma, "geradoEm" | "empresas"> & {
  geradoEm: Date;
  empresas: LinhaDoPainel[];
};

/** Quem entrou nesta janela conta como "entrou no mês". */
const JANELA_DE_USO_MS = 30 * 24 * 3_600_000;

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

interface DadosDaPlataforma {
  usuarios: Map<string, number>;
  usuariosNoMes: Map<string, number>;
  liberacoes: LiberacaoGravada[];
  ultimoLogin: Map<string, Date>;
  integracoes: { empresaId: string; tipo: TipoIntegracao }[];
}

/** Mês ("AAAA-MM") de um instante, no fuso do negócio. */
const mesDe = (d: Date) => hojeNoFuso(FUSO_DO_NEGOCIO, d).slice(0, 7);

async function linhaDaEmpresa(
  naEmpresa: NaEmpresa,
  deps: DependenciasPainel,
  empresa: EmpresaGravada,
  plataforma: DadosDaPlataforma,
  meses: readonly string[],
  agora: Date,
): Promise<LinhaDoPainel> {
  const db = naEmpresa(empresa.id);
  const [ctesPorMes, ingestao, worker] = await Promise.all([
    db(({ plataforma: p }) => p.ctesPorMes(`${meses[0] ?? ""}-01`))
      .then((linhas) => meses.map((m) => linhas.find((l) => l.mes === m)?.total ?? 0))
      .catch((erro: unknown) => {
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
    semNumeros: ctesPorMes === null,
    agora,
  });
  const ligadas = new Set(
    plataforma.integracoes.filter((i) => i.empresaId === empresa.id).map((i) => i.tipo),
  );
  return {
    id: empresa.id,
    nome: empresa.nome,
    nomeCurto: empresa.nomeCurto,
    status: empresa.status,
    corPrimaria: empresa.corPrimaria,
    criadaEm: empresa.criadoEm,
    usuariosAtivos: plataforma.usuarios.get(empresa.id) ?? 0,
    usuariosNoMes: plataforma.usuariosNoMes.get(empresa.id) ?? 0,
    modulosLiberados: modulosLiberados(empresa, plataforma.liberacoes, agora),
    ultimoLoginEm,
    saude,
    integracoes: TIPOS_INTEGRACAO.filter((t) => ligadas.has(t)),
    ssw,
    workerSsw: { situacao: worker.situacao, jobsComFalha: worker.jobsComFalha },
    ultimoDadoEm: ingestao.ultimoDadoEm,
    xml: ingestao.xml,
    ctesPorMes,
  };
}

/** Do mais grave ao mais leve; empate pelo nome. */
const ORDEM_DO_NIVEL: Record<NivelDeSaude, number> = { critico: 0, atencao: 1, ok: 2, inativa: 3 };

/** Empresas novas em cada mês e o total cadastrado até o fim dele. */
function crescimento(empresas: readonly EmpresaGravada[], meses: readonly string[]) {
  const criadas = empresas.map((e) => mesDe(e.criadoEm));
  return meses.map((mes) => ({
    mes,
    novas: criadas.filter((m) => m === mes).length,
    total: criadas.filter((m) => m <= mes).length,
  }));
}

export async function obterPainel(
  naEmpresa: NaEmpresa,
  deps: DependenciasPainel,
): Promise<PainelMontado> {
  const agora = deps.agora();
  const meses = ultimosMeses(hojeNoFuso(FUSO_DO_NEGOCIO, agora));
  const desde = new Date(agora.getTime() - JANELA_DE_USO_MS);

  const { empresas, ...plataforma } = await naEmpresa(null)(async ({ plataforma: p }) => ({
    empresas: await p.empresas(),
    usuarios: await p.usuariosAtivosPorEmpresa(),
    usuariosNoMes: await p.usuariosComAcessoDesde(desde),
    liberacoes: await p.liberacoes(null),
    ultimoLogin: await p.ultimoLoginPorEmpresa(),
    integracoes: await p.integracoesLigadas(),
  }));
  const linhas = (
    await Promise.all(
      empresas.map((e) => linhaDaEmpresa(naEmpresa, deps, e, plataforma, meses, agora)),
    )
  ).sort(
    (a, b) =>
      ORDEM_DO_NIVEL[a.saude.nivel] - ORDEM_DO_NIVEL[b.saude.nivel] ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const porNivel: Record<NivelDeSaude, number> = { ok: 0, atencao: 0, critico: 0, inativa: 0 };
  const porStatus: Record<StatusEmpresa, number> = {
    implantacao: 0,
    ativa: 0,
    suspensa: 0,
    encerrada: 0,
  };
  for (const l of linhas) {
    porNivel[l.saude.nivel] += 1;
    porStatus[l.status] += 1;
  }
  const porMes = crescimento(empresas, meses);
  const somar = (campo: (l: LinhaDoPainel) => number) => linhas.reduce((s, l) => s + campo(l), 0);

  return {
    geradoEm: agora,
    meses,
    totais: {
      empresas: linhas.length,
      porStatus,
      porNivel,
      novasNoMes: porMes.at(-1)?.novas ?? 0,
      novasNoAno: porMes.reduce((s, m) => s + m.novas, 0),
      usuariosAtivos: somar((l) => l.usuariosAtivos),
      usuariosNoMes: somar((l) => l.usuariosNoMes),
      ctesPorMes: meses.map((_, i) => somar((l) => l.ctesPorMes?.[i] ?? 0)),
    },
    crescimento: porMes,
    integracoes: TIPOS_INTEGRACAO.map((tipo) => ({
      tipo,
      empresas: linhas.filter((l) => l.integracoes.includes(tipo)).length,
    })),
    empresas: linhas,
  };
}

/** Quanto o painel montado vale: a tela pode atualizar à vontade sem refazer as consultas. */
const VALIDADE_DO_PAINEL_MS = 60_000;

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
