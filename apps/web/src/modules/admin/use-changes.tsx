import {
  descreverMudanca,
  ROTULO_DA_ACAO,
  ROTULO_DA_ENTIDADE,
  ROTULO_DO_ATOR,
} from "@erp/shared/audit";
import { LIMITE_AUDITORIA, type LinhaAuditoria } from "@erp/shared/contracts/audit";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { ModalDetalhe } from "@/components/common/Detail";
import { BuscaNaBarra, Escolha, opcoesDoMapa } from "@/components/common/FormFields";
import { Aviso } from "@/components/common/Notice";
import { SeloStatus } from "@/components/common/StatusBadge";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";

import { consultaAlteracoes, type EscopoDasAlteracoes } from "./api";
import { FiltroDePeriodo } from "./components/PeriodFilter";
import { ultimosDias } from "./rules";

/** Partes de uma tela de logs para o molde `Pagina`: a barra de filtros e o conteúdo. */
export interface PartesDosLogs {
  filtros: ReactNode;
  conteudo: ReactNode;
}

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

  const consulta = useQuery({ ...consultaAlteracoes(escopo, filtros), enabled: ativo });
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
      <FiltroDePeriodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
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
