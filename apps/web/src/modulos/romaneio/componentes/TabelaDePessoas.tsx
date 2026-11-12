/** Abas Performance Motorista e Ajudante. origem: features/romaneio/Fase2Views.tsx (sistema atual) */
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";

import { consultaPerformanceAjudantes, consultaPerformanceMotoristas } from "../api";
import { type PropsDaAba } from "../busca";
import {
  CLASSE_CODIGO,
  CLASSE_NUMERO,
  CLASSE_TD,
  TIP_PERFORMANCE,
  TIP_PREJUDICADAS,
  TIP_VIAGENS,
} from "../textos";
import { AtribuicaoLegenda } from "./AtribuicaoLegenda";
import { Cabecalho } from "./Cabecalho";
import { CabecalhoPlaca } from "./CabecalhoPlaca";
import { EstadoDaTabela } from "./EstadoDaTabela";
import { MotivosNaoEntrega } from "./MotivosNaoEntrega";
import { PrejuizoSubtitulo } from "./PrejuizoSubtitulo";
import { Produtividade } from "./Produtividade";
import { propsDaLinha, TabelaPropria } from "./TabelaPropria";
import { Th } from "./Th";
import { TituloComDica } from "./TituloComDica";

export function TabelaDePessoas({
  tipo,
  filtros,
  podeVerPlaca,
  aoAbrir,
}: PropsDaAba & { tipo: "motorista" | "ajudante"; podeVerPlaca: boolean }) {
  const consulta =
    tipo === "motorista"
      ? consultaPerformanceMotoristas(filtros)
      : consultaPerformanceAjudantes(filtros);
  const q = useQuery(consulta);
  const linhas = q.data ?? [];
  const [placaVisivel, setPlacaVisivel] = useState(false);
  const mostrarPlaca = podeVerPlaca && placaVisivel;
  const ehMotorista = tipo === "motorista";
  const titulo = ehMotorista ? "Motorista" : "Ajudante";
  const colunas = 7 + (ehMotorista ? 1 : 0);
  return (
    <>
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <Produtividade linhas={linhas} />
      <Painel
        icone={UserRound}
        titulo={`Performance por ${tipo}`}
        acoes={
          <ExportMenu
            arquivo={`romaneio-${tipo}`}
            titulo={`Performance por ${tipo}`}
            colunas={[
              { chave: "nome", titulo },
              // Placa só sai na exportação para quem tem a permissão.
              ...(podeVerPlaca ? [{ chave: "placas", titulo: "Placas" }] : []),
              ...(ehMotorista ? [{ chave: "equipe", titulo: "Equipe" }] : []),
              { chave: "viagens", titulo: "Qtd. viagens", formato: "inteiro" },
              { chave: "romaneados", titulo: "CTRC — levados", formato: "inteiro" },
              { chave: "entregues", titulo: "CTRC — entregues", formato: "inteiro" },
              { chave: "prejudicadas", titulo: "CTRC — prejudicadas", formato: "inteiro" },
              { chave: "prejudicadas13", titulo: "Prejudicadas (cód. 13)", formato: "inteiro" },
              { chave: "performanceFracao", titulo: "% Performance", formato: "percentual" },
            ]}
            linhas={linhas.map((r) => ({
              ...r,
              performanceFracao: r.romaneados > 0 ? r.performance / 100 : null,
            }))}
            soIcone
          />
        }
        rodape={
          !ehMotorista && (
            <span>
              O CTRC conta inteiro para cada ajudante listado nele, então o total desta aba não
              fecha com o universo de CTRCs do período.
            </span>
          )
        }
      >
        <TabelaPropria>
          <Cabecalho>
            <Th>
              {ehMotorista ? (
                titulo
              ) : (
                <TituloComDica dica="CTRC com mais de um ajudante conta integralmente para cada um; o total desta aba é maior que o número de CTRCs.">
                  Ajudante
                </TituloComDica>
              )}
            </Th>
            <Th>
              <CabecalhoPlaca
                pode={podeVerPlaca}
                visivel={mostrarPlaca}
                aoAlternar={() => {
                  setPlacaVisivel((v) => !v);
                }}
              />
            </Th>
            {ehMotorista && <Th>Equipe</Th>}
            <Th direita>
              <TituloComDica dica={TIP_VIAGENS}>Qtd. viagens</TituloComDica>
            </Th>
            <Th direita>CTRC — levados</Th>
            <Th direita>CTRC — entregues</Th>
            <Th direita>
              <TituloComDica dica={TIP_PREJUDICADAS}>CTRC — prejudicadas</TituloComDica>
              <PrejuizoSubtitulo codigos={filtros.codigos} />
            </Th>
            <Th direita>
              <TituloComDica dica={TIP_PERFORMANCE}>% Performance</TituloComDica>
            </Th>
          </Cabecalho>
          <tbody>
            <EstadoDaTabela
              colunas={colunas}
              carregando={q.isLoading}
              erro={q.error}
              aoTentarDeNovo={() => void q.refetch()}
              vazio={linhas.length === 0}
              mensagem={`Nenhum ${tipo} com saída para entrega no período.`}
            />
            {linhas.map((r) => (
              <tr
                key={r.nome}
                {...propsDaLinha(
                  ehMotorista
                    ? () => {
                        aoAbrir({ motorista: r.nome });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_TD}>{r.nome}</td>
                <td className={`${CLASSE_CODIGO} text-muted-foreground`}>
                  {mostrarPlaca ? (
                    (r.placas ?? "—")
                  ) : (
                    <span aria-label="Placa oculta">•••••••</span>
                  )}
                </td>
                {ehMotorista && <td className={CLASSE_TD}>{r.equipe ?? "—"}</td>}
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.viagens)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.romaneados)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.entregues)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.prejudicadas)}</td>
                <td
                  className={`${CLASSE_NUMERO} font-semibold`}
                  title={`${formatarInteiro(r.romaneados)} levados − ${formatarInteiro(r.prejudicadas13)} prejudicados (cód. 13)`}
                >
                  {r.romaneados > 0
                    ? formatarPercentual(r.performance, { escala: "cem", casas: 2 })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TabelaPropria>
      </Painel>
      <MotivosNaoEntrega filtros={filtros} aoAbrir={aoAbrir} />
    </>
  );
}
