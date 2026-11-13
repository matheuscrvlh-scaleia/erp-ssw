import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import { Truck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { FiltrandoPor } from "@/components/common/AdvancedFilters";
import { ExportMenu } from "@/components/common/ExportMenu";
import { Painel } from "@/components/common/Panel";

import { consultaPorViagem } from "../api";
import { type PropsDaAba } from "../search";
import { CLASSE_CODIGO, CLASSE_NUMERO, CLASSE_TD } from "../texts";
import { TituloDoBloco } from "./BlockTitle";
import { Cabecalho } from "./Header";
import { PrejuizoSubtitulo } from "./LossSubtitle";
import { propsDaLinha, TabelaPropria } from "./OwnTable";
import { CaixaDeBusca } from "./SearchBox";
import { EstadoDaTabela } from "./TableState";
import { Th } from "./Th";
import { TituloComDica } from "./TitleWithHint";

/** Uma linha por romaneio real (viagem), do relatório 036. */
export function TabelaPorViagem({ filtros, aoAbrir }: PropsDaAba) {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(texto.trim());
    }, 400);
    return () => {
      clearTimeout(t);
    };
  }, [texto]);
  const q = useQuery(consultaPorViagem(filtros, busca));
  const linhas = (q.data ?? []).map((r) => ({
    ...r,
    ajudantes: [r.ajudante, r.ajudante2, r.ajudante3].filter((a): a is string => !!a).join(", "),
  }));
  return (
    <Painel
      icone={Truck}
      titulo={
        <TituloDoBloco dica="Cada linha é um romaneio de entrega do sistema, com o motorista, os ajudantes e a placa que efetivamente saíram naquela viagem. Só aparecem as cargas que estão dentro dos filtros escolhidos.">
          Por romaneio (viagem real)
        </TituloDoBloco>
      }
      acoes={
        <ExportMenu
          arquivo="romaneio-por-viagem"
          titulo="Por romaneio (viagem real)"
          colunas={[
            { chave: "romaneio", titulo: "Romaneio" },
            { chave: "dataRomaneio", titulo: "Data", formato: "data" },
            { chave: "situacao", titulo: "Situação" },
            { chave: "placa", titulo: "Placa" },
            { chave: "motorista", titulo: "Motorista" },
            { chave: "ajudantes", titulo: "Ajudantes" },
            { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
            { chave: "transferidas", titulo: "Remanejadas", formato: "inteiro" },
            { chave: "frete", titulo: "Frete", formato: "moeda" },
            { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
            { chave: "naoEntregues", titulo: "Não entregues", formato: "inteiro" },
            { chave: "performanceFracao", titulo: "Performance", formato: "percentual" },
            { chave: "fretePerdido", titulo: "Frete perdido", formato: "moeda" },
          ]}
          linhas={linhas.map((r) => ({
            ...r,
            performanceFracao: r.performance === null ? null : r.performance / 100,
          }))}
          soIcone
        />
      }
      barra={
        <>
          <CaixaDeBusca
            valor={texto}
            aoMudar={setTexto}
            placeholder="Buscar romaneio..."
            rotulo="Buscar por número do romaneio"
            ativo={busca !== ""}
            className="w-[220px]"
          >
            {texto.length > 0 && (
              <button
                type="button"
                aria-label="Limpar busca de romaneio"
                title="Limpar busca de romaneio"
                onClick={() => {
                  setTexto("");
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </CaixaDeBusca>
          <FiltrandoPor
            etiquetas={[
              busca && {
                rotulo: "Romaneio",
                valor: busca,
                limpar: () => {
                  setTexto("");
                  setBusca("");
                },
              },
            ]}
          />
        </>
      }
      rodape={
        <span>
          {busca
            ? `${formatarInteiro(linhas.length)} romaneio(s) encontrado(s) para "${busca}".`
            : "Mostra até 300 romaneios, dos maiores para os menores."}{" "}
          Clique em uma linha para abrir as cargas daquela placa.
        </span>
      }
    >
      <TabelaPropria>
        <Cabecalho>
          <Th>Romaneio</Th>
          <Th>Data</Th>
          <Th>Situação</Th>
          <Th>Placa</Th>
          <Th>Motorista</Th>
          <Th>Ajudantes</Th>
          <Th direita>CTRC</Th>
          <Th direita>
            <TituloComDica dica="Cargas que saíram neste romaneio e saíram de novo em outra viagem depois. Elas contam na coluna CTRC deste romaneio como não entregues; a entrega conta na viagem em que aconteceu.">
              Remanejadas
            </TituloComDica>
          </Th>
          <Th direita>Frete que saiu</Th>
          <Th direita>Entregues</Th>
          <Th direita>Não entregues</Th>
          <Th direita>Performance</Th>
          <Th direita>
            Frete perdido
            <PrejuizoSubtitulo codigos={filtros.codigos} />
          </Th>
        </Cabecalho>
        <tbody>
          <EstadoDaTabela
            colunas={13}
            carregando={q.isLoading}
            erro={q.error}
            aoTentarDeNovo={() => void q.refetch()}
            vazio={linhas.length === 0}
            mensagem={
              busca
                ? `Nenhum romaneio encontrado para "${busca}" no período e filtros escolhidos.`
                : "Nenhum romaneio importado para o período e filtros escolhidos."
            }
          />
          {linhas.map((r) => {
            const placa = r.placa;
            return (
              <tr
                key={r.romaneio}
                {...propsDaLinha(
                  placa
                    ? () => {
                        aoAbrir({ placa });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_CODIGO}>{r.romaneio}</td>
                <td className={`${CLASSE_TD} whitespace-nowrap`}>{formatarData(r.dataRomaneio)}</td>
                <td className={CLASSE_TD}>{r.situacao ?? "—"}</td>
                <td className={CLASSE_CODIGO}>{placa ?? "—"}</td>
                <td className={CLASSE_TD}>{r.motorista ?? "—"}</td>
                <td className={`${CLASSE_TD} text-muted-foreground`}>{r.ajudantes || "—"}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.ctes)}</td>
                <td className={`${CLASSE_NUMERO} text-muted-foreground`}>
                  {r.transferidas > 0 ? formatarInteiro(r.transferidas) : "—"}
                </td>
                <td className={CLASSE_NUMERO}>{formatarMoeda(r.frete, { centavos: false })}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.entregues)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.naoEntregues)}</td>
                <td className={`${CLASSE_NUMERO} font-semibold`}>
                  {r.performance !== null
                    ? formatarPercentual(r.performance, { escala: "cem" })
                    : "—"}
                </td>
                <td className={CLASSE_NUMERO}>
                  {r.fretePerdido > 0 ? formatarMoeda(r.fretePerdido, { centavos: false }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TabelaPropria>
    </Painel>
  );
}
