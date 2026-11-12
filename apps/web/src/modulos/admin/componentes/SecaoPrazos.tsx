import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosAdmin as c,
  type DadosDoPrazo,
  type PrazoConfigurado,
  type TipoDePrazo,
} from "@erp/shared/contratos/admin";
import { type UseQueryResult } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Skeleton } from "@/componentes/ui/skeleton";

import { ModalDeRegraDePrazo } from "./ModalDeRegraDePrazo";
import { SubSecaoDePrazos } from "./SubSecaoDePrazos";

interface Gravacao<E> {
  gravar: (entrada: E) => Promise<boolean>;
  gravando: boolean;
}

/** Prazos de entrega: as regras por unidade, parceiro e transbordo, com o modal de cada uma. */
export function SecaoPrazos({
  consulta,
  salvar,
  ligar,
  excluir,
}: {
  consulta: UseQueryResult<SaidaDe<typeof c.listarPrazos>>;
  salvar: Gravacao<{ id: string | null; dados: DadosDoPrazo }>;
  ligar: Gravacao<{ id: string; ativo: boolean }>;
  excluir: Gravacao<string>;
}) {
  const [modal, setModal] = useState<{ tipo: TipoDePrazo; regra: PrazoConfigurado | null } | null>(
    null,
  );

  const regras = consulta.data?.regras ?? [];
  const doTipo = (tipo: TipoDePrazo) => regras.filter((r) => r.tipo === tipo);
  const acoes = {
    aoEditar: (r: PrazoConfigurado) => {
      setModal({ tipo: r.tipo, regra: r });
    },
    aoLigar: (r: PrazoConfigurado, ativo: boolean) => void ligar.gravar({ id: r.id, ativo }),
    aoExcluir: (r: PrazoConfigurado) => {
      if (window.confirm("Remover esta regra e recalcular os CT-e afetados?")) {
        void excluir.gravar(r.id);
      }
    },
  };

  return (
    <Painel
      titulo="Prazos de entrega"
      icone={CalendarClock}
      descricao={
        <>
          Regras manuais que sobrepõem o prazo do SSW. Prioridade: <strong>parceiro</strong> &gt;{" "}
          <strong>transbordo</strong> &gt; <strong>unidade</strong> &gt; SSW. Valem para os CT-e
          novos na hora; os já existentes são recalculados logo depois de salvar. Sem regra, o CT-e
          volta à previsão do SSW.
        </>
      }
      classeDoCorpo="divide-y divide-border"
    >
      {consulta.isLoading && (
        <div role="status" className="space-y-3 px-5 py-4" aria-label="Carregando regras…">
          <Skeleton className="h-3.5 w-1/3 bg-muted" />
          <Skeleton className="h-10 bg-muted" />
          <Skeleton className="h-10 bg-muted" />
        </div>
      )}
      {consulta.error && (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar as regras"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      )}
      {consulta.data && (
        <>
          <SubSecaoDePrazos
            titulo="Por unidade"
            descricao="Prazo fixo em horas após a chegada na unidade (ocorrência 84)."
            regras={doTipo("unidade")}
            aoAdicionar={() => {
              setModal({ tipo: "unidade", regra: null });
            }}
            descrever={(r) => (
              <>
                <span className="font-mono text-xs font-semibold">{r.unidadeCodigo}</span>
                <span className="text-muted-foreground">{r.prazoHoras}h após chegada</span>
              </>
            )}
            {...acoes}
          />
          <SubSecaoDePrazos
            titulo="Por parceiro"
            descricao="Prazo em dias após a emissão, acordado com o parceiro. Tem prioridade sobre transbordo e unidade."
            regras={doTipo("parceiro")}
            aoAdicionar={() => {
              setModal({ tipo: "parceiro", regra: null });
            }}
            descrever={(r) => (
              <>
                <span className="truncate font-medium">{r.parceiroNome ?? "—"}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.parceiroCnpj}</span>
                <span className="text-muted-foreground">{r.prazoDias} dias após emissão</span>
              </>
            )}
            {...acoes}
          />
          <SubSecaoDePrazos
            titulo="Transbordo"
            descricao="CT-e que chega em uma filial e é repassado para outra. O prazo conta em dias a partir da chegada na filial destino."
            regras={doTipo("transbordo")}
            aoAdicionar={() => {
              setModal({ tipo: "transbordo", regra: null });
            }}
            descrever={(r) => (
              <>
                <span className="font-mono text-xs font-semibold">
                  {r.unidadeCodigo} → {r.unidadeDestinoCodigo}
                </span>
                <span className="text-muted-foreground">
                  {r.prazoDias} dias após chegada em {r.unidadeDestinoCodigo}
                </span>
              </>
            )}
            {...acoes}
          />
        </>
      )}
      {modal && consulta.data && (
        <ModalDeRegraDePrazo
          tipo={modal.tipo}
          regra={modal.regra}
          opcoes={consulta.data}
          aoFechar={() => {
            setModal(null);
          }}
          aoGravar={async (dados) => {
            const gravou = await salvar.gravar({ id: modal.regra?.id ?? null, dados });
            if (gravou) setModal(null);
          }}
          gravando={salvar.gravando}
        />
      )}
    </Painel>
  );
}
