import { formatarInteiro, formatarMoeda } from "@erp/shared/formatacao";
import { type LucideIcon } from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";

import { type Abertura } from "../busca";
import { BarrasCarregando } from "./BarrasCarregando";
import { ComDica } from "./ComDica";
import { TituloDoBloco } from "./TituloDoBloco";
import { Trilho } from "./Trilho";

interface LinhaDoRanking {
  nome: string;
  placa: string | null;
  ctes: number;
  frete: number;
  abertura: Abertura;
}

export function RankingDoPrejuizo({
  titulo,
  dica,
  icone,
  linhas,
  carregando,
  arquivo,
  aoAbrir,
}: {
  titulo: string;
  dica: string;
  icone: LucideIcon;
  linhas: readonly LinhaDoRanking[];
  carregando: boolean;
  arquivo: string;
  aoAbrir: (a: Abertura) => void;
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.frete));
  return (
    <Painel
      icone={icone}
      titulo={<TituloDoBloco dica={dica}>{titulo}</TituloDoBloco>}
      acoes={
        <ExportMenu
          arquivo={arquivo}
          titulo={`Prejuízo — ${titulo}`}
          colunas={[
            { chave: "nome", titulo: "Nome" },
            { chave: "placa", titulo: "Placa" },
            { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
            { chave: "frete", titulo: "Frete", formato: "moeda" },
          ]}
          linhas={linhas}
          soIcone
        />
      }
      classeDoCorpo="px-3 py-3"
    >
      {carregando && <BarrasCarregando />}
      {!carregando && linhas.length === 0 && <EstadoVazio mensagem="Nada a mostrar no período." />}
      <ul className="space-y-0.5">
        {linhas.map((l, i) => (
          <li key={`${l.nome}-${i}`}>
            <ComDica
              texto={`${l.nome}${l.placa ? ` (${l.placa})` : ""}: ${formatarMoeda(l.frete, { centavos: false })} · ${formatarInteiro(l.ctes)} CTRC`}
            >
              <button
                type="button"
                onClick={() => {
                  aoAbrir(l.abertura);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60"
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {l.nome}
                    {l.placa && (
                      <span className="ml-1.5 font-mono text-[12px] text-muted-foreground">
                        {l.placa}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-status-bad-fg tabular-nums">
                    {formatarMoeda(l.frete, { centavos: false })}
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-muted-foreground tabular-nums">
                    {formatarInteiro(l.ctes)}
                  </span>
                </span>
                <Trilho fracao={l.frete / maior} cor="var(--status-bad)" className="mt-1.5 h-1.5" />
              </button>
            </ComDica>
          </li>
        ))}
      </ul>
    </Painel>
  );
}
