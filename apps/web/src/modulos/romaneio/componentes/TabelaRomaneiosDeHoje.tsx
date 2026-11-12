import { type LinhaDoDia } from "@erp/shared/contratos/romaneio";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { ClipboardList } from "lucide-react";
import { useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";

import { type Abertura } from "../busca";
import { ajudantesDa, larguraBairros } from "../regras";
import { CLASSE_CODIGO, CLASSE_NUMERO, CLASSE_TD } from "../textos";
import { Cabecalho } from "./Cabecalho";
import { EstadoDaTabela } from "./EstadoDaTabela";
import { PrejuizoSubtitulo } from "./PrejuizoSubtitulo";
import { propsDaLinha, TabelaPropria } from "./TabelaPropria";
import { Th } from "./Th";
import { TituloComDica } from "./TituloComDica";

/** Tabela "Romaneios de hoje" da aba Hoje: uma linha por romaneio, uma coluna por ajudante. */
export function TabelaRomaneiosDeHoje({
  linhas,
  dia,
  carregando,
  erro,
  aoTentarDeNovo,
  aoAbrir,
}: {
  linhas: readonly LinhaDoDia[];
  dia: string;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  aoAbrir: (a: Abertura) => void;
}) {
  const [bairrosAbertos, setBairrosAbertos] = useState<ReadonlySet<string>>(new Set());
  // Uma coluna por ajudante, tantas quanto o romaneio com mais ajudantes do dia.
  const qtdAjudantes = linhas.reduce((max, l) => Math.max(max, ajudantesDa(l).length), 1);
  const posAjudantes = Array.from({ length: qtdAjudantes }, (_, i) => i);
  const colunas = 12 + qtdAjudantes;
  const larguraColBairros = larguraBairros(linhas.map((l) => l.bairros));

  return (
    <Painel
      titulo="Romaneios de hoje"
      icone={ClipboardList}
      acoes={
        <ExportMenu
          arquivo="romaneio-hoje"
          titulo="Romaneios de hoje"
          subtitulo={formatarData(dia)}
          colunas={[
            { chave: "romaneio", titulo: "Romaneio" },
            { chave: "dataRomaneio", titulo: "Data", formato: "data" },
            { chave: "situacao", titulo: "Situação" },
            { chave: "placa", titulo: "Placa" },
            { chave: "motorista", titulo: "Motorista" },
            ...posAjudantes.map((i) => ({
              chave: `ajudante${i + 1}`,
              titulo: `Ajudante ${i + 1}`,
            })),
            { chave: "rota", titulo: "Rota" },
            { chave: "bairros", titulo: "Bairros" },
            { chave: "ctes", titulo: "CT-e", formato: "inteiro" },
            { chave: "frete", titulo: "Frete", formato: "moeda" },
            { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
            { chave: "naoEntregues", titulo: "Não entregues", formato: "inteiro" },
            { chave: "performance", titulo: "Performance", formato: "percentual" },
            { chave: "fretePerdido", titulo: "Prejuízo", formato: "moeda" },
          ]}
          linhas={linhas.map((l) => {
            const ajudantes = ajudantesDa(l);
            return {
              ...l,
              ...Object.fromEntries(posAjudantes.map((i) => [`ajudante${i + 1}`, ajudantes[i]])),
              performance: l.performance === null ? null : l.performance / 100,
            };
          })}
        />
      }
    >
      <TabelaPropria>
        <Cabecalho>
          <Th>Romaneio</Th>
          <Th>Situação</Th>
          <Th>Placa</Th>
          <Th>Motorista</Th>
          {posAjudantes.map((i) => (
            <Th key={i}>Ajudante {i + 1}</Th>
          ))}
          <Th>
            <TituloComDica dica="Cidades de entrega dos CT-e deste romaneio, cada uma uma vez só. A cidade com mais CT-e aparece primeiro.">
              Rota
            </TituloComDica>
          </Th>
          <Th style={{ width: larguraColBairros }}>
            <TituloComDica dica="Bairros de entrega dos CT-e deste romaneio (relatório 036), cada um uma vez só. O bairro com mais CT-e aparece primeiro. Quando não cabem em 3 linhas, clique na célula para ver todos.">
              Bairros
            </TituloComDica>
          </Th>
          <Th direita>CT-e</Th>
          <Th direita>Frete que saiu</Th>
          <Th direita>Entregues</Th>
          <Th direita>Não entregues</Th>
          <Th direita>Performance</Th>
          <Th direita>
            Prejuízo
            <PrejuizoSubtitulo />
          </Th>
        </Cabecalho>
        <tbody>
          <EstadoDaTabela
            colunas={colunas}
            carregando={carregando}
            erro={erro}
            aoTentarDeNovo={aoTentarDeNovo}
            vazio={linhas.length === 0}
            mensagem="Nenhum romaneio emitido hoje até agora."
          />
          {linhas.map((l) => {
            const ajudantes = ajudantesDa(l);
            const placa = l.placa;
            const aberto = bairrosAbertos.has(l.romaneio);
            return (
              <tr
                key={l.romaneio}
                {...propsDaLinha(
                  placa
                    ? () => {
                        aoAbrir({ placa });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_CODIGO}>{l.romaneio}</td>
                <td className={CLASSE_TD}>{l.situacao ?? "—"}</td>
                <td className={CLASSE_CODIGO}>{placa ?? "—"}</td>
                <td className={CLASSE_TD}>{l.motorista ?? "—"}</td>
                {posAjudantes.map((i) => (
                  <td key={i} className={`${CLASSE_TD} text-muted-foreground`}>
                    {ajudantes[i] ?? "—"}
                  </td>
                ))}
                <td className="min-w-[180px] px-4 py-2.5">{l.rota ?? "—"}</td>
                <td
                  className="px-4 py-2.5 text-[12.5px] leading-snug"
                  style={{ minWidth: larguraColBairros }}
                >
                  {l.bairros ? (
                    <button
                      type="button"
                      aria-expanded={aberto}
                      onClick={(e) => {
                        // Só expande os bairros; não abre a lista da placa.
                        e.stopPropagation();
                        setBairrosAbertos((atual) => {
                          const novo = new Set(atual);
                          if (novo.has(l.romaneio)) novo.delete(l.romaneio);
                          else novo.add(l.romaneio);
                          return novo;
                        });
                      }}
                      title={aberto ? "Recolher" : l.bairros}
                      className={`rounded text-left hover:text-brand ${aberto ? "" : "line-clamp-3"}`}
                    >
                      {l.bairros}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(l.ctes)}</td>
                <td className={CLASSE_NUMERO}>{formatarMoeda(l.frete, { centavos: false })}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(l.entregues)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(l.naoEntregues)}</td>
                <td className={`${CLASSE_NUMERO} font-semibold`}>
                  {l.performance !== null
                    ? formatarPercentual(l.performance, { escala: "cem" })
                    : "—"}
                </td>
                <td className={CLASSE_NUMERO}>
                  {l.fretePerdido > 0 ? formatarMoeda(l.fretePerdido, { centavos: false }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TabelaPropria>
    </Painel>
  );
}
