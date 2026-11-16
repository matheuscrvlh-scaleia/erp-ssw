import {
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaIntegracao,
  ORIGENS_DOS_LOGS_DA_EMPRESA,
} from "@erp/shared/contracts/audit";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { Aviso } from "@/components/common/Notice";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Alternador } from "@/components/common/Toggle";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";

import { consultaLogsDaEmpresaNaPlataforma } from "./api";
import { FiltroDePeriodo } from "./components/PeriodFilter";
import { ultimosDias } from "./rules";
import { tomDaSituacao } from "./texts";

type Origem = (typeof ORIGENS_DOS_LOGS_DA_EMPRESA)[number];

const ROTULO: Record<Origem, string> = {
  ciclo_ssw: "Ciclos do Worker",
  relatorio_ssw: "Relatórios recebidos",
  bi2: "BI2",
};

const OPCOES = ORIGENS_DOS_LOGS_DA_EMPRESA.map((o) => ({ valor: o, rotulo: ROTULO[o] }));

const COLUNAS: ColunaTabela<LinhaIntegracao>[] = [
  { chave: "quando", titulo: "Data/hora", formato: "datahora", classe: "whitespace-nowrap" },
  {
    chave: "status",
    titulo: "Situação",
    celula: (l) => l.status && <SeloStatus tom={tomDaSituacao(l.status)}>{l.status}</SeloStatus>,
  },
  // O resumo do ciclo diz os arquivos que faltaram ("faltam 455, 930").
  { chave: "resumo", titulo: "O que fez", classe: "max-w-[480px]" },
  { chave: "erro", titulo: "Mensagem", classe: "max-w-[320px] truncate text-muted-foreground" },
];

/**
 * Plataforma › Empresa › Integrações › Logs: ciclos e relatórios do Worker SSW e as sincronizações
 * do BI2 da empresa, uma origem por vez. Com `ativo` falso nada é consultado.
 */
export function useLogsDaEmpresaNaPlataforma(empresaId: string, ativo: boolean) {
  const fuso = useFusoDaEmpresa();
  const inicial = () => ultimosDias(7, fuso);
  const [origem, setOrigem] = useState<Origem>("ciclo_ssw");
  const [periodo, setPeriodo] = useState(inicial);
  const padrao = inicial();
  const consulta = useQuery({
    ...consultaLogsDaEmpresaNaPlataforma(empresaId, { origem, ...periodo }),
    enabled: ativo,
  });
  const linhas = consulta.data?.linhas ?? [];

  const filtros = (
    <div className="flex flex-wrap items-center gap-2">
      <Alternador opcoes={OPCOES} valor={origem} aoMudar={setOrigem} rotulo="Origem do log" />
      <FiltrosAvancados
        ativos={periodo.de !== padrao.de || periodo.ate !== padrao.ate}
        aoLimpar={() => {
          setPeriodo(inicial());
        }}
      >
        <FiltroDePeriodo
          de={periodo.de}
          ate={periodo.ate}
          aoMudar={(parte) => {
            setPeriodo((p) => ({ ...p, ...parte }));
          }}
        />
      </FiltrosAvancados>
    </div>
  );

  const conteudo = (
    <>
      {linhas.length >= LIMITE_INTEGRACAO_POR_ORIGEM && (
        <Aviso tom="alerta">
          Mostrando as {LIMITE_INTEGRACAO_POR_ORIGEM} execuções mais recentes. Reduza o período para
          ver o restante.
        </Aviso>
      )}
      <TabelaDados
        colunas={COLUNAS}
        linhas={linhas}
        chaveDaLinha={(l) => l.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nada no período."
        rotuloTotal={(n) => `${String(n)} registro${n === 1 ? "" : "s"}`}
        exportacao={{
          arquivo: `logs-${origem}`,
          titulo: `Logs · ${ROTULO[origem]}`,
          subtitulo: `Período ${periodo.de || "—"} a ${periodo.ate || "—"}`,
        }}
      />
    </>
  );
  return { filtros, conteudo };
}
