import {
  descreverMudanca,
  ROTULO_DA_ACAO,
  ROTULO_DA_ENTIDADE,
  ROTULO_DA_ORIGEM,
  ROTULO_DO_ATOR,
} from "@erp/shared/auditoria";
import {
  contratosAuditoria as a,
  LIMITE_AUDITORIA,
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaAuditoria,
  type LinhaIntegracao,
  ORIGENS_INTEGRACAO,
} from "@erp/shared/contratos/auditoria";
import { hojeNoFuso, somarDias } from "@erp/shared/datas";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { BuscaNaBarra, Escolha, opcoesDoMapa } from "@/componentes/comum/CamposDeFormulario";
import { ModalDetalhe } from "@/componentes/comum/Detalhe";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";

/** Partes de uma tela de logs para o molde `Pagina`: a barra de filtros e o conteúdo. */
interface PartesDosLogs {
  filtros: ReactNode;
  conteudo: ReactNode;
}

type AbaDosLogs = "alteracoes" | "integracoes";

const ABAS_DOS_LOGS: readonly { valor: AbaDosLogs; rotulo: string }[] = [
  { valor: "alteracoes", rotulo: "Alterações" },
  { valor: "integracoes", rotulo: "Integrações" },
];

/**
 * Logs com as abas Alterações e Integrações (decisão Q31: a aba Integrações segue o papel na
 * empresa ativa). Sem `empresaId`: Admin › Logs (empresa ativa). Com ele: Plataforma › Empresa ›
 * Logs. Com `ativo` falso (a aba da empresa está fechada), nada é consultado.
 */
export function useLogsComAbas({
  empresaId,
  ativo = true,
}: {
  empresaId?: string | undefined;
  ativo?: boolean | undefined;
} = {}) {
  const [aba, setAba] = useState<AbaDosLogs>("alteracoes");
  const alteracoes = useAlteracoes(
    empresaId ? { empresaFixa: empresaId } : "empresa",
    ativo && aba === "alteracoes",
  );
  const integracoes = useIntegracoes(empresaId, ativo && aba === "integracoes");
  const atual = aba === "alteracoes" ? alteracoes : integracoes;
  return {
    /** Abas no cabeçalho da página (Admin › Logs). */
    abas: <Abas abas={ABAS_DOS_LOGS} valor={aba} aoMudar={setAba} rotulo="Tipo de log" />,
    /** A mesma escolha dentro de uma aba da empresa, na barra de filtros. */
    alternador: (
      <Alternador opcoes={ABAS_DOS_LOGS} valor={aba} aoMudar={setAba} rotulo="Tipo de log" />
    ),
    filtros: atual.filtros,
    conteudo: atual.conteudo,
  };
}

const ultimosDias = (dias: number, fuso: string) => {
  const hoje = hojeNoFuso(fuso);
  return { de: somarDias(hoje, -dias), ate: hoje };
};
const ouNada = (v: string) => (v.trim() ? v.trim() : undefined);

type EscopoDasAlteracoes =
  "empresa" | { empresaFixa: string } | { empresas: readonly { id: string; nome: string }[] };

function colunasDaAuditoria(comEmpresa: boolean): ColunaTabela<LinhaAuditoria>[] {
  return [
    { chave: "criadoEm", titulo: "Data/hora", formato: "datahora", classe: "whitespace-nowrap" },
    ...(comEmpresa
      ? [
          {
            chave: "empresa",
            titulo: "Empresa",
            valor: (l: LinhaAuditoria) => l.empresaNome ?? "Plataforma",
          },
        ]
      : []),
    {
      chave: "quem",
      titulo: "Quem",
      valor: (l) => l.atorEmail ?? ROTULO_DO_ATOR[l.atorTipo],
      celula: (l) => (
        <div className="space-y-1">
          <div className="truncate">{l.atorEmail ?? "—"}</div>
          <SeloStatus tom="neutro" semIcone>
            {ROTULO_DO_ATOR[l.atorTipo]}
          </SeloStatus>
        </div>
      ),
    },
    { chave: "tipo", titulo: "Tipo", valor: (l) => ROTULO_DO_ATOR[l.atorTipo], oculta: true },
    { chave: "acao", titulo: "Ação", valor: (l) => ROTULO_DA_ACAO[l.acao] ?? l.acao },
    {
      chave: "entidade",
      titulo: "Entidade",
      valor: (l) => ROTULO_DA_ENTIDADE[l.entidade] ?? l.entidade,
      celula: (l) => (
        <>
          {ROTULO_DA_ENTIDADE[l.entidade] ?? l.entidade}
          {l.entidadeId && (
            <div className="max-w-[180px] truncate text-xs text-muted-foreground">
              {l.entidadeId}
            </div>
          )}
        </>
      ),
    },
    { chave: "entidadeId", titulo: "Identificador", oculta: true },
    {
      chave: "mudanca",
      titulo: "O que mudou",
      valor: (l) => descreverMudanca(l),
      classe: "max-w-[420px] truncate text-muted-foreground",
    },
  ];
}

/** Alterações nos cadastros: da empresa ativa, de uma empresa (Plataforma) ou de todas. */
export function useAlteracoes(escopo: EscopoDasAlteracoes, ativo = true): PartesDosLogs {
  const fuso = useFusoDaEmpresa();
  const inicial = () => ({
    ...ultimosDias(30, fuso),
    ator: "",
    entidade: "",
    acao: "",
    empresa: "",
  });
  const [filtros, setFiltros] = useState(inicial);
  const [aberta, setAberta] = useState<LinhaAuditoria | null>(null);
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const empresas = typeof escopo === "object" && "empresas" in escopo ? escopo.empresas : null;
  const padrao = inicial();
  const mexidos =
    Boolean(filtros.ator || filtros.entidade || filtros.acao || filtros.empresa) ||
    filtros.de !== padrao.de ||
    filtros.ate !== padrao.ate;

  const entrada = {
    ator: ouNada(filtros.ator),
    entidade: ouNada(filtros.entidade),
    acao: ouNada(filtros.acao),
    de: ouNada(filtros.de),
    ate: ouNada(filtros.ate),
  };
  const consulta = useQuery({
    queryKey: ["logs", "alteracoes", escopo, filtros],
    queryFn: () => {
      if (escopo === "empresa") return chamar(a.alteracoesDaEmpresa, { entrada });
      const empresa = "empresaFixa" in escopo ? escopo.empresaFixa : ouNada(filtros.empresa);
      return chamar(a.alteracoesDaPlataforma, { entrada: { ...entrada, empresa } });
    },
    enabled: ativo,
  });
  const linhas = consulta.data?.linhas ?? [];

  const filtrosDaTela = (
    <FiltrosAvancados
      ativos={mexidos}
      aoLimpar={() => {
        setFiltros(inicial());
      }}
    >
      {empresas && (
        <Escolha
          filtro
          rotulo="Empresa"
          vazio="Todas as empresas"
          opcoes={[
            { valor: "plataforma", rotulo: "Só ações da Plataforma" },
            ...empresas.map((e) => ({ valor: e.id, rotulo: e.nome })),
          ]}
          valor={filtros.empresa}
          aoMudar={(empresa) => {
            mudar({ empresa });
          }}
        />
      )}
      <Periodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
      <Escolha
        filtro
        rotulo="Entidade"
        vazio="Todas as entidades"
        opcoes={opcoesDoMapa(ROTULO_DA_ENTIDADE)}
        valor={filtros.entidade}
        aoMudar={(entidade) => {
          mudar({ entidade });
        }}
      />
      <Escolha
        filtro
        rotulo="Ação"
        vazio="Todas as ações"
        opcoes={opcoesDoMapa(ROTULO_DA_ACAO)}
        valor={filtros.acao}
        aoMudar={(acao) => {
          mudar({ acao });
        }}
      />
      <BuscaNaBarra
        rotulo="Quem"
        placeholder="Quem (e-mail)…"
        valor={filtros.ator}
        aoMudar={(ator) => {
          mudar({ ator });
        }}
      />
    </FiltrosAvancados>
  );

  const conteudo = (
    <>
      {linhas.length >= LIMITE_AUDITORIA && (
        <Aviso tom="alerta">
          Mostrando os {LIMITE_AUDITORIA} registros mais recentes. Reduza o período ou aplique mais
          filtros para ver o restante.
        </Aviso>
      )}

      <TabelaDados
        colunas={colunasDaAuditoria(empresas !== null)}
        linhas={linhas}
        chaveDaLinha={(l) => String(l.id)}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum registro no período."
        aoClicarLinha={setAberta}
        linhaAtiva={aberta ? String(aberta.id) : null}
        configurarColunas
        exportacao={{
          arquivo: empresas ? "logs-plataforma" : "logs-empresa",
          titulo: empresas ? "Logs da Plataforma" : "Logs da empresa",
          subtitulo: `Período ${filtros.de || "—"} a ${filtros.ate || "—"}`,
        }}
      />

      {aberta && (
        <ModalDetalhe
          aberto
          largura="larga"
          aoFechar={() => {
            setAberta(null);
          }}
          titulo={`${ROTULO_DA_ACAO[aberta.acao] ?? aberta.acao} · ${ROTULO_DA_ENTIDADE[aberta.entidade] ?? aberta.entidade}`}
          descricao={descreverMudanca(aberta)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Bloco titulo="Antes" valor={aberta.antes} />
            <Bloco titulo="Depois" valor={aberta.depois} />
          </div>
          {aberta.ip && <p className="text-xs text-muted-foreground">IP: {aberta.ip}</p>}
        </ModalDetalhe>
      )}
    </>
  );

  return { filtros: filtrosDaTela, conteudo };
}

function tomDaSituacao(status: string | null): Tom {
  const s = (status ?? "").toLowerCase();
  if (/(erro|falh|error|fail)/.test(s)) return "erro";
  if (/(ok|sucesso|conclu|success|importado|aplicado|done)/.test(s)) return "sucesso";
  return "neutro";
}

const COLUNAS_DA_INTEGRACAO: ColunaTabela<LinhaIntegracao>[] = [
  { chave: "quando", titulo: "Data/hora", formato: "datahora", classe: "whitespace-nowrap" },
  {
    chave: "origem",
    titulo: "Integração",
    valor: (l) => ROTULO_DA_ORIGEM[l.origem],
    classe: "whitespace-nowrap",
  },
  {
    chave: "status",
    titulo: "Situação",
    celula: (l) => l.status && <SeloStatus tom={tomDaSituacao(l.status)}>{l.status}</SeloStatus>,
  },
  { chave: "resumo", titulo: "O que fez", classe: "max-w-[420px]" },
  { chave: "erro", titulo: "Mensagem", classe: "max-w-[320px] truncate text-muted-foreground" },
];

function useIntegracoes(empresaId: string | undefined, ativo: boolean): PartesDosLogs {
  // Dezenas de execuções por dia: começa nos últimos 7 dias.
  const fuso = useFusoDaEmpresa();
  const inicial = () => ({ ...ultimosDias(7, fuso), origem: "" });
  const [filtros, setFiltros] = useState(inicial);
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const padrao = inicial();
  const mexidos = filtros.origem !== "" || filtros.de !== padrao.de || filtros.ate !== padrao.ate;
  const origem = ORIGENS_INTEGRACAO.find((o) => o === filtros.origem);
  const entrada = { origem, de: ouNada(filtros.de), ate: ouNada(filtros.ate) };
  const consulta = useQuery({
    queryKey: ["logs", "integracoes", empresaId ?? "ativa", filtros],
    queryFn: () =>
      empresaId
        ? chamar(a.integracoesDeEmpresaNaPlataforma, { parametros: { id: empresaId }, entrada })
        : chamar(a.integracoesDaEmpresa, { entrada }),
    enabled: ativo,
  });
  const linhas = consulta.data?.linhas ?? [];
  const noLimite = ORIGENS_INTEGRACAO.some(
    (o) => linhas.filter((l) => l.origem === o).length >= LIMITE_INTEGRACAO_POR_ORIGEM,
  );

  const filtrosDaTela = (
    <FiltrosAvancados
      ativos={mexidos}
      aoLimpar={() => {
        setFiltros(inicial());
      }}
    >
      <Periodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
      <Escolha
        filtro
        rotulo="Integração"
        vazio="Todas as integrações"
        opcoes={opcoesDoMapa(ROTULO_DA_ORIGEM)}
        valor={filtros.origem}
        aoMudar={(o) => {
          mudar({ origem: o });
        }}
      />
    </FiltrosAvancados>
  );

  const conteudo = (
    <>
      {noLimite && (
        <Aviso tom="alerta">
          Mostrando as {LIMITE_INTEGRACAO_POR_ORIGEM} execuções mais recentes de cada integração.
          Reduza o período ou escolha uma integração para ver o restante.
        </Aviso>
      )}
      <TabelaDados
        colunas={COLUNAS_DA_INTEGRACAO}
        linhas={linhas}
        chaveDaLinha={(l) => l.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhuma execução no período."
        rotuloTotal={(n) => `${String(n)} execuç${n === 1 ? "ão" : "ões"}`}
        exportacao={{
          arquivo: "logs-integracoes",
          titulo: "Logs das integrações",
          subtitulo: `Período ${filtros.de || "—"} a ${filtros.ate || "—"}`,
        }}
      />
    </>
  );

  return { filtros: filtrosDaTela, conteudo };
}

/** De / Até num controle só, no desenho dos outros filtros da barra. */
function Periodo({
  de,
  ate,
  aoMudar,
}: {
  de: string;
  ate: string;
  aoMudar: (parte: { de?: string; ate?: string }) => void;
}) {
  const data =
    "h-full rounded-md bg-transparent px-1.5 text-[13px] tabular-nums outline-none focus-visible:bg-muted";
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card pr-1 pl-3 text-[13px] shadow-cartao"
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="date"
        aria-label="De"
        className={data}
        value={de}
        onChange={(e) => {
          aoMudar({ de: e.target.value });
        }}
      />
      <span className="text-muted-foreground">a</span>
      <input
        type="date"
        aria-label="Até"
        className={data}
        value={ate}
        onChange={(e) => {
          aoMudar({ ate: e.target.value });
        }}
      />
    </div>
  );
}

function Bloco({ titulo, valor }: { titulo: string; valor: Record<string, unknown> | null }) {
  return (
    <div className="min-w-0">
      <div className="label-xs mb-1.5">{titulo}</div>
      <pre className="rolagem-fina max-h-72 overflow-auto rounded-lg border border-border bg-muted p-3 text-xs">
        {valor ? JSON.stringify(valor, null, 2) : "—"}
      </pre>
    </div>
  );
}
