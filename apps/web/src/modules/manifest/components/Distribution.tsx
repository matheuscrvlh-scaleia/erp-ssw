import { type FiltrosRomaneio } from "@erp/shared/contracts/manifest";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { InfoTip } from "@/components/common/InfoTip";
import { ItemDeLegenda, Painel } from "@/components/common/Panel";
import { Alternador } from "@/components/common/Toggle";

import { type Abertura } from "../search";
import { BarrasPorCodigo } from "./BarsByCode";
import { TabelaCarros } from "./VehiclesTable";

type Visao = "codigo" | "placa";

const VISOES: readonly { valor: Visao; rotulo: string }[] = [
  { valor: "codigo", rotulo: "Por código" },
  { valor: "placa", rotulo: "Por carro" },
];

/**
 * Distribuição dos CT-e romaneados ainda não finalizados por código efetivo e, em "Por carro",
 * a performance por motorista + placa.
 */
export function Distribuicao({
  filtros,
  nomeCurto,
  aoAbrir,
}: {
  filtros: FiltrosRomaneio;
  nomeCurto: string;
  aoAbrir: (a: Abertura) => void;
}) {
  const [visao, setVisao] = useState<Visao>("codigo");
  const porCodigo = visao === "codigo";
  return (
    <Painel
      icone={BarChart3}
      titulo={
        <span className="inline-flex items-center gap-1.5">
          {porCodigo ? "Distribuição dos não finalizados" : "Performance por carro"}
          <InfoTip
            texto={
              porCodigo
                ? "Cada CT-e romaneado que ainda não foi finalizado (não entregue e sem baixa) conta uma vez, no seu código efetivo atual. O total das barras é igual ao card 'Não entregues' desta aba. As pendências que travam a finalização (cliente ou transportadora) aparecem em destaque. Clique numa barra para ver as cargas daquele código."
                : `Uma linha por motorista e placa do romaneio de entrega do SSW (ou do SSW Mobile, quando não há romaneio). Entregas = CT-es que saíram para entrega naquele carro no período. Entrega prejudicada = dessas, as que tiveram ocorrência penalizante da ${nomeCurto} nos códigos do filtro (padrão: 13). Performance = 100% − % Prejudicada. Clique numa linha para ver as cargas daquele motorista e placa.`
            }
          />
        </span>
      }
      barra={
        <>
          <Alternador
            rotulo="Agrupar distribuição por"
            tamanho="pequeno"
            opcoes={VISOES}
            valor={visao}
            aoMudar={setVisao}
          />
          {porCodigo && (
            <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              <ItemDeLegenda cor="var(--brand)">Demais códigos</ItemDeLegenda>
              <ItemDeLegenda cor="var(--status-bad)">
                Pendência (cliente ou transportadora)
              </ItemDeLegenda>
            </span>
          )}
        </>
      }
    >
      {porCodigo ? (
        <BarrasPorCodigo filtros={filtros} aoAbrir={aoAbrir} />
      ) : (
        <TabelaCarros filtros={filtros} aoAbrir={aoAbrir} />
      )}
    </Painel>
  );
}
