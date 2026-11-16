import { ROTULO_DA_ORIGEM } from "@erp/shared/audit";
import {
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaIntegracao,
  ORIGENS_INTEGRACAO,
} from "@erp/shared/contracts/audit";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { Escolha, opcoesDoMapa } from "@/components/common/FormFields";
import { Aviso } from "@/components/common/Notice";
import { SeloStatus } from "@/components/common/StatusBadge";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";

import { consultaIntegracoes } from "./api";
import { FiltroDePeriodo } from "./components/PeriodFilter";
import { ultimosDias } from "./rules";
import { tomDaSituacao } from "./texts";
import { type PartesDosLogs } from "./use-changes";

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

/** Execuções das integrações da empresa ativa. Com `ativo` falso nada é consultado. */
export function useIntegracoes({ ativo }: { ativo: boolean }): PartesDosLogs {
  // Dezenas de execuções por dia: começa nos últimos 7 dias.
  const fuso = useFusoDaEmpresa();
  const inicial = () => ({ ...ultimosDias(7, fuso), origem: "" });
  const [filtros, setFiltros] = useState(inicial);
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const padrao = inicial();
  const mexidos = filtros.origem !== "" || filtros.de !== padrao.de || filtros.ate !== padrao.ate;
  const consulta = useQuery({ ...consultaIntegracoes(filtros), enabled: ativo });
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
      <FiltroDePeriodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
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
