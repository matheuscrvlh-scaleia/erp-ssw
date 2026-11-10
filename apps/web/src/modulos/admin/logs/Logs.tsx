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
import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { ModalDetalhe } from "@/componentes/comum/Detalhe";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";

import { Selo } from "../comum";

/**
 * Logs (decisão Q31: a aba Integrações segue o papel na empresa ativa). Sem `empresaId`: Admin ›
 * Logs (empresa ativa). Com ele: Plataforma › Empresa › Logs.
 */
export function LogsComAbas({ empresaId }: { empresaId?: string }) {
  const [aba, setAba] = useState<"alteracoes" | "integracoes">("alteracoes");
  return (
    <div className="space-y-3">
      <Abas
        abas={[
          { valor: "alteracoes", rotulo: "Alterações" },
          { valor: "integracoes", rotulo: "Integrações" },
        ]}
        valor={aba}
        aoMudar={setAba}
      />
      {aba === "alteracoes" ? (
        <PainelAlteracoes escopo={empresaId ? { empresaFixa: empresaId } : "empresa"} />
      ) : (
        <PainelIntegracoes empresaId={empresaId} />
      )}
    </div>
  );
}

const ultimosDias = (dias: number, fuso: string) => {
  const hoje = hojeNoFuso(fuso);
  return { de: somarDias(hoje, -dias), ate: hoje };
};
const ouNada = (v: string) => (v.trim() ? v.trim() : undefined);

const FILTRO = "h-8 rounded-md border border-input bg-background px-2 text-[12px] shadow-sm";

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
        <div className="space-y-0.5">
          <div className="truncate">{l.atorEmail ?? "—"}</div>
          <Selo>{ROTULO_DO_ATOR[l.atorTipo]}</Selo>
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
            <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">
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

export function PainelAlteracoes({ escopo }: { escopo: EscopoDasAlteracoes }) {
  const fuso = useFusoDaEmpresa();
  const [filtros, setFiltros] = useState(() => ({
    ...ultimosDias(30, fuso),
    ator: "",
    entidade: "",
    acao: "",
    empresa: "",
  }));
  const [aberta, setAberta] = useState<LinhaAuditoria | null>(null);
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const empresas = typeof escopo === "object" && "empresas" in escopo ? escopo.empresas : null;

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
  });
  const linhas = consulta.data?.linhas ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {empresas && (
          <select
            aria-label="Empresa"
            className={`${FILTRO} w-[200px]`}
            value={filtros.empresa}
            onChange={(e) => {
              mudar({ empresa: e.target.value });
            }}
          >
            <option value="">Todas as empresas</option>
            <option value="plataforma">Só ações da Plataforma</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        <input
          placeholder="Quem (e-mail)…"
          aria-label="Quem"
          className={`${FILTRO} w-[180px]`}
          value={filtros.ator}
          onChange={(e) => {
            mudar({ ator: e.target.value });
          }}
        />
        <Escolha
          rotulo="Entidade"
          todas="Todas as entidades"
          opcoes={ROTULO_DA_ENTIDADE}
          valor={filtros.entidade}
          aoMudar={(entidade) => {
            mudar({ entidade });
          }}
        />
        <Escolha
          rotulo="Ação"
          todas="Todas as ações"
          opcoes={ROTULO_DA_ACAO}
          valor={filtros.acao}
          aoMudar={(acao) => {
            mudar({ acao });
          }}
        />
        <Periodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
      </div>

      {linhas.length >= LIMITE_AUDITORIA && (
        <p className="text-[11px] text-status-warn-fg">
          Mostrando os {LIMITE_AUDITORIA} registros mais recentes. Reduza o período ou aplique mais
          filtros para ver o restante.
        </p>
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
          {aberta.ip && <p className="mt-2 text-[11px] text-muted-foreground">IP: {aberta.ip}</p>}
        </ModalDetalhe>
      )}
    </div>
  );
}

function tomDaSituacao(status: string | null): "ruim" | "bom" | "neutro" {
  const s = (status ?? "").toLowerCase();
  if (/(erro|falh|error|fail)/.test(s)) return "ruim";
  if (/(ok|sucesso|conclu|success|importado|aplicado|done)/.test(s)) return "bom";
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
    celula: (l) => l.status && <Selo tom={tomDaSituacao(l.status)}>{l.status}</Selo>,
  },
  { chave: "resumo", titulo: "O que fez", classe: "max-w-[420px]" },
  { chave: "erro", titulo: "Mensagem", classe: "max-w-[320px] truncate text-muted-foreground" },
];

function PainelIntegracoes({ empresaId }: { empresaId?: string | undefined }) {
  // Dezenas de execuções por dia: começa nos últimos 7 dias.
  const fuso = useFusoDaEmpresa();
  const [filtros, setFiltros] = useState(() => ({ ...ultimosDias(7, fuso), origem: "" }));
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const origem = ORIGENS_INTEGRACAO.find((o) => o === filtros.origem);
  const entrada = { origem, de: ouNada(filtros.de), ate: ouNada(filtros.ate) };
  const consulta = useQuery({
    queryKey: ["logs", "integracoes", empresaId ?? "ativa", filtros],
    queryFn: () =>
      empresaId
        ? chamar(a.integracoesDeEmpresaNaPlataforma, { parametros: { id: empresaId }, entrada })
        : chamar(a.integracoesDaEmpresa, { entrada }),
  });
  const linhas = consulta.data?.linhas ?? [];
  const noLimite = ORIGENS_INTEGRACAO.some(
    (o) => linhas.filter((l) => l.origem === o).length >= LIMITE_INTEGRACAO_POR_ORIGEM,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Escolha
          rotulo="Integração"
          todas="Todas as integrações"
          opcoes={ROTULO_DA_ORIGEM}
          valor={filtros.origem}
          aoMudar={(o) => {
            mudar({ origem: o });
          }}
        />
        <Periodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
      </div>
      {noLimite && (
        <p className="text-[11px] text-status-warn-fg">
          Mostrando as {LIMITE_INTEGRACAO_POR_ORIGEM} execuções mais recentes de cada integração.
          Reduza o período ou escolha uma integração para ver o restante.
        </p>
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
    </div>
  );
}

function Escolha({
  rotulo,
  todas,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  todas: string;
  opcoes: Record<string, string>;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <select
      aria-label={rotulo}
      className={`${FILTRO} w-[200px]`}
      value={valor}
      onChange={(e) => {
        aoMudar(e.target.value);
      }}
    >
      <option value="">{todas}</option>
      {Object.entries(opcoes).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function Periodo({
  de,
  ate,
  aoMudar,
}: {
  de: string;
  ate: string;
  aoMudar: (parte: { de?: string; ate?: string }) => void;
}) {
  return (
    <>
      <input
        type="date"
        aria-label="De"
        className={`${FILTRO} w-[140px]`}
        value={de}
        onChange={(e) => {
          aoMudar({ de: e.target.value });
        }}
      />
      <input
        type="date"
        aria-label="Até"
        className={`${FILTRO} w-[140px]`}
        value={ate}
        onChange={(e) => {
          aoMudar({ ate: e.target.value });
        }}
      />
    </>
  );
}

function Bloco({ titulo, valor }: { titulo: string; valor: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {titulo}
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 text-[11px]">
        {valor ? JSON.stringify(valor, null, 2) : "—"}
      </pre>
    </div>
  );
}
