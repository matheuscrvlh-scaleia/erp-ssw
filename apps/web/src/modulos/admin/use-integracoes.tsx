import { ROTULO_DA_ORIGEM } from "@erp/shared/auditoria";
import {
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaIntegracao,
  ORIGENS_INTEGRACAO,
} from "@erp/shared/contratos/auditoria";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { Escolha, opcoesDoMapa } from "@/componentes/comum/CamposDeFormulario";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";

import { consultaIntegracoes } from "./api";
import { FiltroDePeriodo } from "./componentes/FiltroDePeriodo";
import { ultimosDias } from "./regras";
import { tomDaSituacao } from "./textos";
import { type PartesDosLogs } from "./use-alteracoes";

/**
 * Plataforma › Empresa › Integrações › Logs: as execuções das integrações da empresa, uma
 * integração por vez no alternador (ou todas). Com `ativo` falso nada é consultado.
 */
export function useLogsDasIntegracoes(empresaId: string, ativo: boolean) {
  return useIntegracoes({ empresaId, ativo, porIntegracao: true });
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

/** "" = todas as integrações. */
const OPCOES_DAS_INTEGRACOES = [
  { valor: "", rotulo: "Todas" },
  ...ORIGENS_INTEGRACAO.map((o) => ({ valor: o, rotulo: ROTULO_DA_ORIGEM[o] })),
];

/** Execuções das integrações: da empresa ativa ou, com `empresaId`, de uma empresa (Plataforma). */
export function useIntegracoes({
  empresaId,
  ativo,
  porIntegracao = false,
}: {
  /** Sem ela: a empresa ativa da sessão. */
  empresaId?: string;
  ativo: boolean;
  /** A integração vai num alternador fora dos filtros, um log por integração. */
  porIntegracao?: boolean;
}): PartesDosLogs & { alternador: ReactNode } {
  // Dezenas de execuções por dia: começa nos últimos 7 dias.
  const fuso = useFusoDaEmpresa();
  const inicial = () => ({ ...ultimosDias(7, fuso), origem: "" });
  const [filtros, setFiltros] = useState(inicial);
  const mudar = (parte: Partial<typeof filtros>) => {
    setFiltros((f) => ({ ...f, ...parte }));
  };
  const padrao = inicial();
  const mexidos =
    (!porIntegracao && filtros.origem !== "") ||
    filtros.de !== padrao.de ||
    filtros.ate !== padrao.ate;
  const consulta = useQuery({ ...consultaIntegracoes(empresaId, filtros), enabled: ativo });
  const linhas = consulta.data?.linhas ?? [];
  const noLimite = ORIGENS_INTEGRACAO.some(
    (o) => linhas.filter((l) => l.origem === o).length >= LIMITE_INTEGRACAO_POR_ORIGEM,
  );

  const filtrosDaTela = (
    <FiltrosAvancados
      ativos={mexidos}
      aoLimpar={() => {
        setFiltros((f) => ({ ...inicial(), origem: porIntegracao ? f.origem : "" }));
      }}
    >
      <FiltroDePeriodo de={filtros.de} ate={filtros.ate} aoMudar={mudar} />
      {!porIntegracao && (
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
      )}
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

  const alternador = (
    <Alternador
      opcoes={OPCOES_DAS_INTEGRACOES}
      valor={filtros.origem}
      aoMudar={(o) => {
        mudar({ origem: o });
      }}
      rotulo="Integração"
    />
  );
  return { filtros: filtrosDaTela, conteudo, alternador };
}
