import { type CteDaFaixa, type FaixaDoDia, type LinhaDoDia } from "@erp/shared/contratos/romaneio";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarData } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltrandoPor, resumirNomes } from "@/componentes/comum/FiltrosAvancados";
import { ordenarPorPlaca } from "@/componentes/comum/ordenar-por-placa";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/componentes/ui/sheet";
import { COLUNA_LINK_SSW, urlCtrcNoSsw } from "@/lib/exportacao";

import { consultaCtesDoDia, consultaHoje, consultaOpcoes } from "./api";
import { type Abertura } from "./busca";
import { CardAba, FaixaChip, GradeCards, InfoTip, PrejuizoSubtitulo } from "./componentes";
import { fmtMoedaInteira, nfInt, nfPct } from "./formatos";
import { useAbrirCte } from "./navegacao";

const SEM_TIPO = "__SEM_TIPO__";

type Faixa = Exclude<FaixaDoDia, "todas">;

const ROTULO_FAIXA: Record<Faixa, string> = {
  vencida: "Prazo vencido",
  hoje: "Vencendo no dia",
  futuro: "Vencimento futuro",
  sem_prev: "Sem prazo definido",
};

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

/** Painel lateral com os CT-e da faixa clicada. */
function GavetaDaFaixa({
  faixa,
  somenteEmRota,
  filiais,
  tipos,
  aoFechar,
}: {
  faixa: Faixa | null;
  /** Só os ainda não entregues (os do card "Em rota de entrega"). */
  somenteEmRota: boolean;
  filiais: string[];
  tipos: string[];
  aoFechar: () => void;
}) {
  const abrirCte = useAbrirCte();
  const q = useQuery({
    ...consultaCtesDoDia({
      faixa: faixa ?? "todas",
      apenasNaoEntregues: somenteEmRota,
      ...(filiais.length > 0 ? { filiais } : {}),
      ...(tipos.length > 0 ? { tipos } : {}),
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
    <Sheet
      open={faixa !== null}
      onOpenChange={(aberta) => {
        if (!aberta) aoFechar();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle>
                {rotulo}
                {somenteEmRota ? " · em rota" : ""}
                {q.data ? ` · ${nfInt.format(total)} CT-e` : ""}
              </SheetTitle>
              <SheetDescription>
                {somenteEmRota
                  ? "CT-e desta faixa que ainda não foram entregues, inclusive os que receberam ocorrência depois da saída."
                  : "CT-e dos romaneios emitidos hoje nesta faixa de prazo, em qualquer status."}
                {q.data && total > q.data.limite
                  ? ` Mostrando os ${nfInt.format(q.data.limite)} primeiros de ${nfInt.format(total)}.`
                  : ""}
              </SheetDescription>
            </div>
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
          </div>
        </SheetHeader>
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-border/70">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border/70">
                {[
                  "NF",
                  "CT-e",
                  "Romaneio",
                  "Destinatário",
                  "Pagador",
                  "Cidade/UF",
                  "Emissão",
                  "Prazo",
                  "Situação",
                  "Placa",
                ].map((t) => (
                  <th key={t} className="px-2 py-1.5 text-left font-normal">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                    carregando…
                  </td>
                </tr>
              )}
              {!q.isLoading && linhas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum CT-e nesta faixa.
                  </td>
                </tr>
              )}
              {linhas.map((l) => (
                <tr
                  key={`${l.sigla ?? ""}-${l.numero}-${l.romaneio ?? ""}`}
                  onClick={() => {
                    abrirCte(l.numero);
                  }}
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-2 py-1 font-mono text-[11px]">{l.numeroNf ?? "—"}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{l.numero}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{l.romaneio ?? "—"}</td>
                  <td className="px-2 py-1">{l.destinatario ?? "—"}</td>
                  <td className="px-2 py-1">{l.pagador ?? "—"}</td>
                  <td className="px-2 py-1">{l.cidadeUf ?? "—"}</td>
                  <td className="px-2 py-1 tabular-nums">{formatarData(l.dataEmissao)}</td>
                  <td className="px-2 py-1 tabular-nums">{formatarData(l.dataPrevista)}</td>
                  <td className="px-2 py-1">{l.status}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{l.placa ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Aba "Hoje" — romaneios emitidos no dia corrente (dia de Brasília), ao vivo. O recorte é pela
 * data de emissão DO ROMANEIO (relatório 036), não do CT-e. Prejuízo pelo código 13.
 */
export function AbaHoje({ fuso, aoAbrir }: { fuso: string; aoAbrir: (a: Abertura) => void }) {
  const [gaveta, setGaveta] = useState<{ faixa: Faixa; somenteEmRota: boolean } | null>(null);
  const [filiais, setFiliais] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [bairrosAbertos, setBairrosAbertos] = useState<ReadonlySet<string>>(new Set());
  const q = useQuery(
    consultaHoje({
      ...(filiais.length > 0 ? { filiais } : {}),
      ...(tipos.length > 0 ? { tipos } : {}),
    }),
  );
  const d = q.data;
  const dia = d?.dia ?? hojeNoFuso(fuso);
  const opcoes = useQuery(consultaOpcoes({ campo: "emissao", inicio: dia, fim: dia }));
  const linhas = d?.linhas ?? [];
  // Uma coluna por ajudante, tantas quanto o romaneio com mais ajudantes do dia.
  const qtdAjudantes = linhas.reduce((max, l) => Math.max(max, ajudantesDa(l).length), 1);
  const posAjudantes = Array.from({ length: qtdAjudantes }, (_, i) => i);
  const larguraColBairros = larguraBairros(linhas.map((l) => l.bairros));
  const r = d?.resumo;
  const perf = r && r.ctes > 0 ? (r.entregues / r.ctes) * 100 : null;
  const emRota = r ? Math.max(0, r.ctes - r.entregues) : 0;
  const abrir = (faixa: Faixa, somenteEmRota: boolean) => {
    setGaveta({ faixa, somenteEmRota });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Romaneios emitidos hoje{d ? ` (${formatarData(d.dia)})` : ""} — o recorte usa a{" "}
        <strong>data de emissão do romaneio</strong> (campo DATA EMISSAO do relatório 036), não a
        data de emissão de cada CT-e. Visão ao vivo: atualiza sozinha a cada minuto e inclui viagens
        ainda em andamento. Esta aba não usa os filtros gerais da tela (período, parceiro): é sempre
        o dia de hoje, por romaneio. Para outros dias, use a aba “Performance por romaneio”.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <FiltroMultiplo
          rotulo="Unidade responsável"
          opcoes={opcoes.data?.filiais.map((f) => ({ valor: f.sigla, detalhe: f.nome }))}
          selecionados={filiais}
          aoMudar={setFiliais}
          monoespacado
        />
        <FiltroMultiplo
          rotulo="Tipo documento"
          opcoes={[
            ...(d?.tipos ?? []).map((t) => ({ valor: t })),
            { valor: SEM_TIPO, rotulo: "sem tipo" },
          ]}
          selecionados={tipos}
          aoMudar={setTipos}
        />
      </div>

      <FiltrandoPor
        etiquetas={[
          filiais.length > 0 && {
            rotulo: "Unidade responsável",
            ...resumirNomes(filiais),
            limpar: () => {
              setFiliais([]);
            },
          },
          tipos.length > 0 && {
            rotulo: "Tipo documento",
            ...resumirNomes(tipos.map((t) => (t === SEM_TIPO ? "sem tipo" : t))),
            limpar: () => {
              setTipos([]);
            },
          },
        ]}
      />

      <GradeCards>
        <CardAba
          rotulo="Romaneios de hoje"
          valor={r ? nfInt.format(r.romaneios) : "—"}
          explicacao="Quantidade de romaneios de entrega emitidos hoje."
        />
        <CardAba
          rotulo="CT-e nos romaneios"
          valor={r ? nfInt.format(r.ctes) : "—"}
          dica={r ? `${fmtMoedaInteira(r.frete)} de frete` : undefined}
        />
        <CardAba
          rotulo="Já entregues"
          valor={r ? nfInt.format(r.entregues) : "—"}
          dica={perf !== null ? `${nfPct.format(perf)}% de performance` : undefined}
          tom={perf !== null && perf >= 90 ? "ok" : undefined}
        />
        <CardAba
          rotulo="Em rota de entrega"
          valor={r ? nfInt.format(emRota) : "—"}
          dica={
            r ? `${nfInt.format(r.ctes)} CT-e − ${nfInt.format(r.entregues)} entregues` : undefined
          }
          explicacao="CT-e nos romaneios − Já entregues: o que saiu hoje e ainda não foi entregue, inclusive o que recebeu ocorrência depois da saída. As faixas de “Em rota agora” somam este número."
        />
        <CardAba
          rotulo="Prejuízo"
          sub={<PrejuizoSubtitulo />}
          valor={r ? fmtMoedaInteira(r.prejuizoFrete) : "—"}
          dica={r ? `${nfInt.format(r.prejuizoCtes)} CT-e` : undefined}
          tom={r && r.prejuizoFrete > 0 ? "bad" : undefined}
        />
      </GradeCards>

      <div className="space-y-1.5 rounded-[10px] border border-border/70 bg-card p-2.5">
        {/* Fotografia: o que nasceu em cada faixa (não diminui com a entrega). */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">
            Total no romaneio{r ? ` (${nfInt.format(r.ctes)} CT-e)` : ""}:
          </span>
          <FaixaChip
            rotulo="Vencida"
            valor={r?.prazo.vencida ?? 0}
            tom="danger"
            aoClicar={() => {
              abrir("vencida", false);
            }}
          />
          <FaixaChip
            rotulo="Vencendo no dia"
            valor={r?.prazo.hoje ?? 0}
            tom="warn"
            aoClicar={() => {
              abrir("hoje", false);
            }}
          />
          <FaixaChip
            rotulo="Vencimento futuro"
            valor={r?.prazo.futuro ?? 0}
            tom="ok"
            aoClicar={() => {
              abrir("futuro", false);
            }}
          />
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              abrir("sem_prev", false);
            }}
          >
            sem prazo definido: {nfInt.format(r?.prazo.semPrev ?? 0)}
          </button>
          <InfoTip texto="Fotografia: TODOS os CT-e dos romaneios emitidos hoje, em qualquer status (em rota, entregue, devolvido, travado). Compara a data prevista com o dia de hoje, por isso a soma das faixas é igual ao total de CT-e. Este número NÃO diminui quando a carga é entregue — é o retrato do que nasceu em cada faixa. Clique para ver a lista." />
        </div>
        {/* Quebra do card "Em rota de entrega" por prazo. */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">
            Em rota agora{r ? ` (${nfInt.format(emRota)} CT-e)` : ""}:
          </span>
          <FaixaChip
            rotulo="Vencida"
            valor={r?.prazoNaoEntregue.vencida ?? 0}
            tom="danger"
            aoClicar={() => {
              abrir("vencida", true);
            }}
          />
          <FaixaChip
            rotulo="Vencendo no dia"
            valor={r?.prazoNaoEntregue.hoje ?? 0}
            tom="warn"
            aoClicar={() => {
              abrir("hoje", true);
            }}
          />
          <FaixaChip
            rotulo="Vencimento futuro"
            valor={r?.prazoNaoEntregue.futuro ?? 0}
            tom="ok"
            aoClicar={() => {
              abrir("futuro", true);
            }}
          />
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              abrir("sem_prev", true);
            }}
          >
            sem prazo definido: {nfInt.format(r?.prazoNaoEntregue.semPrev ?? 0)}
          </button>
          <InfoTip texto="Os mesmos CT-e do card “Em rota de entrega” (CT-e nos romaneios − Já entregues), separados pelo prazo: a soma das faixas é igual ao card. Inclui quem recebeu ocorrência depois da saída (ausente, recusa, pendência…) e ainda não foi entregue. Clique para ver a lista." />
        </div>
      </div>

      <GavetaDaFaixa
        faixa={gaveta?.faixa ?? null}
        somenteEmRota={gaveta?.somenteEmRota ?? false}
        filiais={filiais}
        tipos={tipos}
        aoFechar={() => {
          setGaveta(null);
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium">Romaneios de hoje</span>
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
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="px-3 py-1.5 text-left font-normal">Romaneio</th>
              <th className="px-3 py-1.5 text-left font-normal">Situação</th>
              <th className="px-3 py-1.5 text-left font-normal">Placa</th>
              <th className="px-3 py-1.5 text-left font-normal">Motorista</th>
              {posAjudantes.map((i) => (
                <th key={i} className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                  Ajudante {i + 1}
                </th>
              ))}
              <th className="px-3 py-1.5 text-left font-normal">
                <span className="inline-flex items-center gap-1">
                  Rota
                  <InfoTip texto="Cidades de entrega dos CT-e deste romaneio, cada uma uma vez só. A cidade com mais CT-e aparece primeiro." />
                </span>
              </th>
              <th
                className="px-3 py-1.5 text-left font-normal"
                style={{ width: larguraColBairros }}
              >
                <span className="inline-flex items-center gap-1">
                  Bairros
                  <InfoTip texto="Bairros de entrega dos CT-e deste romaneio (relatório 036), cada um uma vez só. O bairro com mais CT-e aparece primeiro. Quando não cabem em 3 linhas, clique na célula para ver todos." />
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-normal">CT-e</th>
              <th className="px-3 py-1.5 text-right font-normal">Frete que saiu</th>
              <th className="px-3 py-1.5 text-right font-normal">Entregues</th>
              <th className="px-3 py-1.5 text-right font-normal">Não entregues</th>
              <th className="px-3 py-1.5 text-right font-normal">Performance</th>
              <th className="px-3 py-1.5 text-right font-normal">
                Prejuízo
                <div className="leading-tight">
                  <PrejuizoSubtitulo />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td
                  colSpan={12 + qtdAjudantes}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  carregando…
                </td>
              </tr>
            )}
            {!q.isLoading && linhas.length === 0 && (
              <tr>
                <td
                  colSpan={12 + qtdAjudantes}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Nenhum romaneio emitido hoje até agora.
                </td>
              </tr>
            )}
            {linhas.map((l) => {
              const ajudantes = ajudantesDa(l);
              const placa = l.placa;
              const aberto = bairrosAbertos.has(l.romaneio);
              return (
                <tr
                  key={l.romaneio}
                  {...(placa
                    ? {
                        onClick: () => {
                          aoAbrir({ placa });
                        },
                      }
                    : {})}
                  className={
                    "border-b border-border/40 last:border-0 " +
                    (placa ? "cursor-pointer hover:bg-muted/40" : "")
                  }
                >
                  <td className="px-3 py-1 font-mono text-[11px]">{l.romaneio}</td>
                  <td className="px-3 py-1">{l.situacao ?? "—"}</td>
                  <td className="px-3 py-1 font-mono text-[11px]">{placa ?? "—"}</td>
                  <td className="px-3 py-1">{l.motorista ?? "—"}</td>
                  {posAjudantes.map((i) => (
                    <td key={i} className="px-3 py-1 text-[11px] text-muted-foreground">
                      {ajudantes[i] ?? "—"}
                    </td>
                  ))}
                  <td className="min-w-[180px] px-3 py-1">{l.rota ?? "—"}</td>
                  <td
                    className="px-3 py-1 text-[11px] leading-snug"
                    style={{ minWidth: larguraColBairros }}
                  >
                    {l.bairros ? (
                      <button
                        type="button"
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
                        className={"text-left " + (aberto ? "" : "line-clamp-3")}
                      >
                        {l.bairros}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(l.ctes)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{fmtMoedaInteira(l.frete)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(l.entregues)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {nfInt.format(l.naoEntregues)}
                  </td>
                  <td className="px-3 py-1 text-right font-medium tabular-nums">
                    {l.performance !== null ? `${nfPct.format(l.performance)}%` : "—"}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {l.fretePerdido > 0 ? fmtMoedaInteira(l.fretePerdido) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
