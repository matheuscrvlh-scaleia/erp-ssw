import { type CteDaFaixa, type FaixaDoDia, type LinhaDoDia } from "@erp/shared/contratos/romaneio";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
} from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, PackageCheck, TrendingDown, Truck } from "lucide-react";
import { useState } from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltrandoPor, FiltrosAvancados, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { ordenarPorPlaca } from "@/componentes/comum/ordenar-por-placa";
import { Painel } from "@/componentes/comum/Painel";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";

import { consultaCtesDoDia, consultaHoje, consultaOpcoes } from "./api";
import { type Abertura } from "./busca";
import {
  Cabecalho,
  CLASSE_CODIGO,
  CLASSE_NUMERO,
  CLASSE_TD,
  EstadoDaTabela,
  FaixasDePrazo,
  GradeDeIndicadores,
  Indicador,
  PrejuizoSubtitulo,
  propsDaLinha,
  TabelaPropria,
  textoDoPrejuizo,
  Th,
  TituloComDica,
} from "./componentes";

const SEM_TIPO = "__SEM_TIPO__";

type Faixa = Exclude<FaixaDoDia, "todas">;

const ROTULO_FAIXA: Record<Faixa, string> = {
  vencida: "Prazo vencido",
  hoje: "Vencendo no dia",
  futuro: "Vencimento futuro",
  sem_prev: "Sem prazo definido",
};

/** Unidade e tipo de documento da aba Hoje (ficam só na visita à aba, fora da URL). */
export interface FiltrosHoje {
  filiais: string[];
  tipos: string[];
}

export const FILTROS_DA_HOJE_VAZIOS: FiltrosHoje = { filiais: [], tipos: [] };

const entradaDaHoje = ({ filiais, tipos }: FiltrosHoje) => ({
  ...(filiais.length > 0 ? { filiais } : {}),
  ...(tipos.length > 0 ? { tipos } : {}),
});

/**
 * Bairros em no máximo 3 linhas: a coluna cresce até 60ch; passou disso, a célula mostra 3
 * linhas e o clique abre a lista inteira.
 */
function larguraBairros(textos: readonly (string | null)[]): string {
  const maior = Math.max(0, ...textos.map((t) => t?.length ?? 0));
  return `${Math.min(60, Math.max(18, Math.ceil(maior / 3) + 4))}ch`;
}

const ajudantesDa = (l: LinhaDoDia) =>
  [l.ajudante, l.ajudante2, l.ajudante3].filter((a): a is string => !!a);

const cidadeUf = (l: CteDaFaixa) =>
  l.cidadeDestino ? `${l.cidadeDestino}${l.ufDestino ? `/${l.ufDestino}` : ""}` : null;

type CteDaGaveta = CteDaFaixa & { cidadeUf: string | null };

const COLUNAS_DA_GAVETA: readonly ColunaTabela<CteDaGaveta>[] = [
  { chave: "numeroNf", titulo: "NF", classe: "font-mono text-[12px]" },
  { chave: "numero", titulo: "CT-e", classe: "font-mono text-[12px]" },
  { chave: "romaneio", titulo: "Romaneio", classe: "font-mono text-[12px]" },
  { chave: "destinatario", titulo: "Destinatário" },
  { chave: "pagador", titulo: "Pagador" },
  { chave: "cidadeUf", titulo: "Cidade/UF" },
  { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
  { chave: "dataPrevista", titulo: "Prazo", formato: "data" },
  { chave: "status", titulo: "Situação" },
  { chave: "placa", titulo: "Placa", classe: "font-mono text-[12px]" },
];

/** Gaveta lateral com os CT-e da faixa clicada. */
function GavetaDaFaixa({
  faixa,
  somenteEmRota,
  filtros,
  aoFechar,
}: {
  faixa: Faixa | null;
  /** Só os ainda não entregues (os do card "Em rota de entrega"). */
  somenteEmRota: boolean;
  filtros: FiltrosHoje;
  aoFechar: () => void;
}) {
  const abrirCte = useAbrirCte();
  const q = useQuery({
    ...consultaCtesDoDia({
      faixa: faixa ?? "todas",
      apenasNaoEntregues: somenteEmRota,
      ...entradaDaHoje(filtros),
    }),
    enabled: faixa !== null,
  });
  // Ordena por placa (vazias no fim), a mesma ordem do arquivo exportado.
  const linhas = ordenarPorPlaca(
    (q.data?.linhas ?? []).map((l) => ({ ...l, cidadeUf: cidadeUf(l) })),
    [{ chave: "placa", titulo: "Placa" }],
  );
  const total = q.data?.total ?? 0;
  const rotulo = faixa ? ROTULO_FAIXA[faixa] : "";
  return (
    <DrawerDetalhe
      aberto={faixa !== null}
      aoFechar={aoFechar}
      largura="larga"
      titulo={`${rotulo}${somenteEmRota ? " · em rota" : ""}${q.data ? ` · ${formatarInteiro(total)} CT-e` : ""}`}
      descricao={`${
        somenteEmRota
          ? "CT-e desta faixa que ainda não foram entregues, inclusive os que receberam ocorrência depois da saída."
          : "CT-e dos romaneios emitidos hoje nesta faixa de prazo, em qualquer status."
      }${
        q.data && total > q.data.limite
          ? ` Mostrando os ${formatarInteiro(q.data.limite)} primeiros de ${formatarInteiro(total)}.`
          : ""
      }`}
      acoes={
        <ExportMenu
          arquivo="romaneio-hoje-faixa"
          titulo={`Romaneio · ${rotulo || "faixa de prazo"}`}
          subtitulo={rotulo}
          colunas={[
            { chave: "numeroNf", titulo: "NF" },
            { chave: "numero", titulo: "CT-e" },
            { chave: "romaneio", titulo: "Romaneio" },
            { chave: "destinatario", titulo: "Destinatário" },
            { chave: "pagador", titulo: "Pagador" },
            { chave: "cidadeUf", titulo: "Cidade/UF" },
            { chave: "dataEmissao", titulo: "Emissão", formato: "data" },
            { chave: "dataPrevista", titulo: "Prazo", formato: "data" },
            { chave: "status", titulo: "Situação" },
            { chave: "placa", titulo: "Placa" },
            { chave: "linkSsw", titulo: COLUNA_LINK_SSW },
          ]}
          linhas={linhas.map((l) => ({
            ...l,
            linkSsw: urlCtrcNoSsw(l.sigla, l.numero, l.dataEmissao),
          }))}
          soIcone
        />
      }
    >
      <TabelaDados
        colunas={COLUNAS_DA_GAVETA}
        linhas={linhas}
        chaveDaLinha={(l) => `${l.sigla ?? ""}-${l.numero}-${l.romaneio ?? ""}`}
        aoClicarLinha={(l) => {
          abrirCte(l.numero);
        }}
        carregando={q.isLoading}
        erro={q.error}
        aoTentarDeNovo={() => void q.refetch()}
        mensagemVazia="Nenhum CT-e nesta faixa."
        porPagina={0}
        rotuloTotal={(n) => `${formatarInteiro(n)} CT-e`}
      />
    </DrawerDetalhe>
  );
}

/** Filtros da aba Hoje (slot `filtros` da página): unidade e tipo de documento do dia. */
export function FiltrosDaHoje({
  fuso,
  filtros,
  aoMudar,
}: {
  fuso: string;
  filtros: FiltrosHoje;
  aoMudar: (filtros: FiltrosHoje) => void;
}) {
  const d = useQuery(consultaHoje(entradaDaHoje(filtros))).data;
  const dia = d?.dia ?? hojeNoFuso(fuso);
  const opcoes = useQuery(consultaOpcoes({ campo: "emissao", inicio: dia, fim: dia }));
  const { filiais, tipos } = filtros;
  return (
    <>
      <FiltrosAvancados
        ativos={filiais.length > 0 || tipos.length > 0}
        aoLimpar={() => {
          aoMudar(FILTROS_DA_HOJE_VAZIOS);
        }}
      >
        <FiltroMultiplo
          rotulo="Unidade responsável"
          opcoes={opcoes.data?.filiais.map((f) => ({ valor: f.sigla, detalhe: f.nome }))}
          selecionados={filiais}
          aoMudar={(v) => {
            aoMudar({ ...filtros, filiais: v });
          }}
          monoespacado
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={[
            ...(d?.tipos ?? []).map((t) => ({ valor: t })),
            { valor: SEM_TIPO, rotulo: "sem tipo" },
          ]}
          selecionados={tipos}
          aoMudar={(v) => {
            aoMudar({ ...filtros, tipos: v });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor
        etiquetas={[
          filiais.length > 0 && {
            rotulo: "Unidade responsável",
            ...resumirNomes(filiais),
            limpar: () => {
              aoMudar({ ...filtros, filiais: [] });
            },
          },
          tipos.length > 0 && {
            rotulo: "Tipo documento",
            ...resumirNomes(tipos.map((t) => (t === SEM_TIPO ? "sem tipo" : t))),
            limpar: () => {
              aoMudar({ ...filtros, tipos: [] });
            },
          },
        ]}
      />
    </>
  );
}

/**
 * Aba "Hoje" — romaneios emitidos no dia corrente (dia de Brasília), ao vivo. O recorte é pela
 * data de emissão DO ROMANEIO (relatório 036), não do CT-e. Prejuízo pelo código 13.
 */
export function AbaHoje({
  fuso,
  filtros,
  aoAbrir,
}: {
  fuso: string;
  filtros: FiltrosHoje;
  aoAbrir: (a: Abertura) => void;
}) {
  const [gaveta, setGaveta] = useState<{ faixa: Faixa; somenteEmRota: boolean } | null>(null);
  const [bairrosAbertos, setBairrosAbertos] = useState<ReadonlySet<string>>(new Set());
  const q = useQuery(consultaHoje(entradaDaHoje(filtros)));
  const d = q.data;
  const dia = d?.dia ?? hojeNoFuso(fuso);
  const linhas = d?.linhas ?? [];
  // Uma coluna por ajudante, tantas quanto o romaneio com mais ajudantes do dia.
  const qtdAjudantes = linhas.reduce((max, l) => Math.max(max, ajudantesDa(l).length), 1);
  const posAjudantes = Array.from({ length: qtdAjudantes }, (_, i) => i);
  const colunas = 12 + qtdAjudantes;
  const larguraColBairros = larguraBairros(linhas.map((l) => l.bairros));
  const r = d?.resumo;
  const perf = r && r.ctes > 0 ? (r.entregues / r.ctes) * 100 : null;
  const emRota = r ? Math.max(0, r.ctes - r.entregues) : 0;
  const abrir = (faixa: Faixa, somenteEmRota: boolean) => {
    setGaveta({ faixa, somenteEmRota });
  };

  return (
    <>
      <Aviso tom="info">
        Romaneios emitidos hoje{d ? ` (${formatarData(d.dia)})` : ""} — o recorte usa a{" "}
        <strong>data de emissão do romaneio</strong> (campo DATA EMISSAO do relatório 036), não a
        data de emissão de cada CT-e. Visão ao vivo: atualiza sozinha a cada minuto e inclui viagens
        ainda em andamento. Esta aba não usa os filtros gerais da tela (período, parceiro): é sempre
        o dia de hoje, por romaneio. Para outros dias, use a aba “Performance por romaneio”.
      </Aviso>

      <GradeDeIndicadores max={5}>
        <Indicador
          rotulo="Romaneios de hoje"
          icone={ClipboardList}
          neutro
          status="bom"
          valor={r ? formatarInteiro(r.romaneios) : "—"}
          detalhe=""
          dica="Quantidade de romaneios de entrega emitidos hoje."
        />
        <Indicador
          rotulo="CT-e nos romaneios"
          icone={FileText}
          neutro
          status="bom"
          valor={r ? formatarInteiro(r.ctes) : "—"}
          detalhe={r ? `${formatarMoeda(r.frete, { centavos: false })} de frete` : ""}
        />
        <Indicador
          rotulo="Já entregues"
          icone={PackageCheck}
          neutro={!(perf !== null && perf >= 90)}
          status="bom"
          valor={r ? formatarInteiro(r.entregues) : "—"}
          detalhe={
            perf !== null ? `${formatarPercentual(perf, { escala: "cem" })} de performance` : ""
          }
        />
        <Indicador
          rotulo="Em rota de entrega"
          icone={Truck}
          neutro
          status="alerta"
          valor={r ? formatarInteiro(emRota) : "—"}
          detalhe={
            r ? `${formatarInteiro(r.ctes)} CT-e − ${formatarInteiro(r.entregues)} entregues` : ""
          }
          dica="CT-e nos romaneios − Já entregues: o que saiu hoje e ainda não foi entregue, inclusive o que recebeu ocorrência depois da saída. As faixas de “Em rota agora” somam este número."
        />
        <Indicador
          rotulo="Prejuízo"
          icone={TrendingDown}
          neutro={!(r && r.prejuizoFrete > 0)}
          status="ruim"
          valor={r ? formatarMoeda(r.prejuizoFrete, { centavos: false }) : "—"}
          detalhe={[textoDoPrejuizo(undefined), r ? `${formatarInteiro(r.prejuizoCtes)} CT-e` : ""]
            .filter(Boolean)
            .join(" · ")}
        />
      </GradeDeIndicadores>

      <Painel classeDoCorpo="grid gap-6 px-5 py-4 lg:grid-cols-2">
        {/* Fotografia: o que nasceu em cada faixa (não diminui com a entrega). */}
        <FaixasDePrazo
          rotulo={`Total no romaneio${r ? ` (${formatarInteiro(r.ctes)} CT-e)` : ""}`}
          dica="Fotografia: TODOS os CT-e dos romaneios emitidos hoje, em qualquer status (em rota, entregue, devolvido, travado). Compara a data prevista com o dia de hoje, por isso a soma das faixas é igual ao total de CT-e. Este número NÃO diminui quando a carga é entregue — é o retrato do que nasceu em cada faixa. Clique para ver a lista."
          faixas={r?.prazo}
          aoAbrir={(faixa) => {
            abrir(faixa, false);
          }}
        />
        {/* Quebra do card "Em rota de entrega" por prazo. */}
        <FaixasDePrazo
          rotulo={`Em rota agora${r ? ` (${formatarInteiro(emRota)} CT-e)` : ""}`}
          dica="Os mesmos CT-e do card “Em rota de entrega” (CT-e nos romaneios − Já entregues), separados pelo prazo: a soma das faixas é igual ao card. Inclui quem recebeu ocorrência depois da saída (ausente, recusa, pendência…) e ainda não foi entregue. Clique para ver a lista."
          faixas={r?.prazoNaoEntregue}
          aoAbrir={(faixa) => {
            abrir(faixa, true);
          }}
        />
      </Painel>

      <GavetaDaFaixa
        faixa={gaveta?.faixa ?? null}
        somenteEmRota={gaveta?.somenteEmRota ?? false}
        filtros={filtros}
        aoFechar={() => {
          setGaveta(null);
        }}
      />

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
              carregando={q.isLoading}
              erro={q.error}
              aoTentarDeNovo={() => void q.refetch()}
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
    </>
  );
}
