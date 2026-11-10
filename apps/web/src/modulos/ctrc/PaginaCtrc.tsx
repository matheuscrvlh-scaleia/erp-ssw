import { statusDoPrazo } from "@erp/dominio/ctrc/detalhe";
import {
  type DetalheCtrc,
  type OcorrenciaDoCtrc,
  type OpcaoDeCtrc,
} from "@erp/shared/contratos/ctrc";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPeso,
} from "@erp/shared/formatacao";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  RefreshCw,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Badge, type BadgeProps } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/componentes/ui/tooltip";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { urlCtrcNoSsw } from "@/lib/exportacao";
import { cn } from "@/lib/utils";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import { consultaCtrc } from "./api";
import { COLUNAS_DO_PDF, linhasDoPdf } from "./exportacao";
import {
  formatarCep,
  formatarChave,
  formatarCnpjOuTraco,
  identificacao,
  nasceuEmAtraso,
  origemDaPrevisao,
  pontualidade,
  rotuloDaFonte,
  textoDaPerformance,
  textoDoAtraso,
  textoDoPrazoMinimo,
} from "./textos";

const rota = getRouteApi("/_autenticado/ctrc/$numero");

/**
 * Detalhe do CT-e pela série + número (Q02). Número repetido entre séries sem a série na URL:
 * a tela pede a escolha.
 * origem: src/routes/_authenticated/ctrc.$numero.tsx (sistema atual)
 */
export function PaginaCtrc() {
  const { numero } = rota.useParams();
  const { sigla } = rota.useSearch();
  const router = useRouter();
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const fuso = useFusoDaEmpresa();
  const { data, isLoading, isError, refetch, isFetching } = useQuery(consultaCtrc(numero, sigla));
  const ctrc = data?.tipo === "encontrado" ? data.ctrc : null;
  const ssw = ctrc ? urlCtrcNoSsw(ctrc.sigla, ctrc.numero, ctrc.dataEmissao) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              router.history.back();
            }}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar
          </Button>
          <Titulo numero={numero} ctrc={ctrc} />
        </div>
        <div className="flex items-center gap-2">
          {ssw && (
            <a
              href={ssw}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-brand transition hover:bg-brand/15"
              title="Abrir este CTRC no SSW"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir no SSW
            </a>
          )}
          {ctrc && (
            <ExportMenu
              arquivo={`ctrc-${ctrc.sigla}-${ctrc.numero}`}
              titulo={`CT-e ${ctrc.sigla} ${ctrc.numero}`}
              subtitulo={ctrc.destinatario ?? undefined}
              colunas={COLUNAS_DO_PDF}
              linhas={linhasDoPdf(ctrc, fuso)}
              formatos={["pdf"]}
              orientacao="retrato"
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1.5 h-3 w-3", isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </header>

      {isLoading && <Esqueleto />}

      {isError && (
        <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-destructive">Falha ao carregar CTRC.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {data?.tipo === "nao_encontrado" && (
        <div className="rounded-[10px] border border-border/70 bg-card p-10 text-center text-muted-foreground">
          CTRC <span className="font-mono">{sigla ? `${sigla} ${numero}` : numero}</span> não
          encontrado.
        </div>
      )}

      {data?.tipo === "varios" && <EscolhaDeSerie numero={numero} opcoes={data.opcoes} />}

      {ctrc && <Detalhe ctrc={ctrc} nomeCurto={nomeCurto} fuso={fuso} />}
    </div>
  );
}

function Titulo({ numero, ctrc }: { numero: string; ctrc: DetalheCtrc | null }) {
  const id = identificacao(ctrc?.numeroNf ?? null, ctrc?.numero ?? numero);
  const semNf = id.rotulo === "CTRC";
  const classe = cn(
    "mr-1.5 text-[13px] font-normal text-muted-foreground",
    semNf && "cursor-help underline decoration-dotted underline-offset-2",
  );
  return (
    <div>
      <h1 className="text-[22px] font-medium tracking-tight">
        {semNf ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={classe}>{id.rotulo}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-[11px]">
              Número da NF ainda não recebido. Ele vem do BI2 (relatório 0174), que roda em D-1.
              Assim que o próximo ciclo cobrir este CTRC, a NF aparece aqui automaticamente.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className={classe}>{id.rotulo}</span>
        )}
        <span className="font-mono text-brand">{id.principal}</span>
      </h1>
      <SeloDosDados />
      <p className="text-[12px] text-muted-foreground">
        {id.secundario ? `CTRC ${ctrc?.sigla ?? ""} ${id.secundario} · ` : ""}
        Detalhes do conhecimento de transporte
      </p>
    </div>
  );
}

/** Q02: o mesmo número em mais de uma série — o operador escolhe qual abrir. */
function EscolhaDeSerie({ numero, opcoes }: { numero: string; opcoes: readonly OpcaoDeCtrc[] }) {
  return (
    <section className="rounded-[10px] border border-border/70 bg-card">
      <header className="border-b border-border/70 px-3 py-2">
        <h2 className="text-[13px] font-medium">
          O número {numero} existe em {opcoes.length} séries. Qual CT-e você quer abrir?
        </h2>
      </header>
      <ul className="divide-y divide-border/40">
        {opcoes.map((o) => (
          <li key={`${o.sigla}-${o.numero}`}>
            <Link
              to="/ctrc/$numero"
              params={{ numero: o.numero }}
              search={{ sigla: o.sigla }}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px] hover:bg-muted"
            >
              <span className="font-mono font-semibold text-brand">
                {o.sigla} {o.numero}
              </span>
              <span className="text-muted-foreground">Emissão {formatarData(o.dataEmissao)}</span>
              <span className="flex-1 truncate">{o.destinatario ?? "—"}</span>
              <span className="text-muted-foreground">{o.cidadeDestino ?? "—"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Detalhe({
  ctrc,
  nomeCurto,
  fuso,
}: {
  ctrc: DetalheCtrc;
  nomeCurto: string;
  fuso: string;
}) {
  const { entregue, baixa } = ctrc.finalizacao;
  const aberto = !entregue && !baixa;
  const rua = [ctrc.logradouroDestino, ctrc.numeroEnderecoDestino]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const cidadeUf = ctrc.cidadeDestino
    ? `${ctrc.cidadeDestino}${ctrc.ufDestino ? ` / ${ctrc.ufDestino}` : ""}`
    : null;
  const complemento = ctrc.complementoDestino?.trim();
  const bairro = ctrc.bairroDestino?.trim();
  const cep = ctrc.cepDestinatario?.trim();
  const temEndereco = Boolean(rua || complemento || bairro || cidadeUf || cep);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border/70 bg-card px-3 py-2 text-[12px]">
        <SeloDeStatus status={ctrc.statusAtual} entregue={entregue} baixa={baixa} />
        {ctrc.dataEntrega && (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Entregue em {formatarDataHora(ctrc.dataEntrega, fuso)}
          </span>
        )}
        {ctrc.dataPrevista && aberto && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Prazo: {formatarData(ctrc.dataPrevista)}
            {ctrc.prazoOrigem && (
              <Selo variante="contorno" className="ml-1 text-[10px]">
                {ctrc.prazoOrigem}
              </Selo>
            )}
          </span>
        )}
      </div>

      {/* Duas colunas, cada uma uma pilha própria (sem buraco entre cards de alturas
          diferentes); no celular empilham: esquerda, depois direita. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Cartao titulo="Identificação">
            {ctrc.numeroNf !== null && (
              <Campo
                rotulo="Número NF"
                valor={<span className="font-mono">{ctrc.numeroNf}</span>}
              />
            )}
            <Campo
              rotulo="Número CTRC"
              valor={
                <span className="font-mono">
                  {ctrc.sigla} {ctrc.numero}
                </span>
              }
            />
            <Campo rotulo="Emissão" valor={formatarData(ctrc.dataEmissao)} />
            <Campo rotulo="Embarque" valor={formatarData(ctrc.dataEmbarque)} />
            {ctrc.chave && <CampoDeChave rotulo="Chave CT-e" chave={ctrc.chave} />}
            {ctrc.chaveNfe && <CampoDeChave rotulo="Chave NF-e" chave={ctrc.chaveNfe} />}
          </Cartao>

          <Cartao titulo="Situação atual">
            <Campo rotulo="Status atual" valor={ctrc.statusAtual ?? "—"} />
            <Campo
              rotulo="Ocorrências"
              valor={
                <JanelaDeOcorrencias
                  ocorrencias={ctrc.ocorrencias}
                  numero={ctrc.numero}
                  fuso={fuso}
                />
              }
            />
            <Campo
              rotulo="Placa do veículo"
              valor={
                ctrc.placa ? (
                  <span className="font-mono">
                    {ctrc.placa}
                    {ctrc.romaneio && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        · {ctrc.romaneio}
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Campo rotulo="Motorista" valor={ctrc.motorista ?? "—"} />
            <Campo rotulo="Localização" valor={ctrc.localizacao ?? "—"} />
          </Cartao>

          <Cartao titulo="Remetente / Destinatário">
            <Campo rotulo="Remetente" valor={ctrc.remetente ?? "—"} />
            <Campo rotulo="Destinatário" valor={ctrc.destinatario ?? "—"} />
            <div className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
              Endereço de entrega
            </div>
            {temEndereco ? (
              <>
                <Campo rotulo="Logradouro" valor={rua || "—"} />
                {complemento && <Campo rotulo="Complemento" valor={complemento} />}
                {bairro && <Campo rotulo="Bairro" valor={bairro} />}
                <Campo rotulo="Cidade / UF" valor={cidadeUf ?? "—"} />
                {cep && (
                  <Campo
                    rotulo="CEP"
                    valor={<span className="font-mono">{formatarCep(cep)}</span>}
                  />
                )}
              </>
            ) : (
              <div className="px-3 pb-2 text-[12px] text-muted-foreground">Não informado.</div>
            )}
          </Cartao>

          <Cartao titulo="Carga & Frete">
            <Campo
              rotulo="Peso"
              valor={formatarPeso(ctrc.peso, { tonelada: 3, quilo: 3, fixas: true })}
            />
            <Campo rotulo="Volumes" valor={formatarInteiro(ctrc.volumes)} />
            <Campo rotulo="Valor do frete" valor={formatarMoeda(ctrc.valorFrete)} />
          </Cartao>
        </div>

        <div className="flex flex-col gap-4">
          <Cartao titulo="Prazos & Entrega">
            <Campo
              rotulo="Prazo contratado"
              valor={ctrc.prazoContratadoDias !== null ? `${ctrc.prazoContratadoDias} dias` : "—"}
            />
            <Campo
              rotulo="Previsão de entrega"
              valor={
                ctrc.prazoFonte ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                        {formatarData(ctrc.dataPrevista)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-[11px]">
                      {origemDaPrevisao(ctrc.prazoFonte, ctrc.dataPrevista)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  formatarData(ctrc.dataPrevista)
                )
              }
            />
            <Campo rotulo="Status do prazo" valor={<SeloDoPrazo ctrc={ctrc} fuso={fuso} />} />
            <Campo rotulo="Origem do prazo" valor={ctrc.prazoOrigem ?? "—"} />
            <Campo
              rotulo="Prazo mínimo (48h)"
              valor={textoDoPrazoMinimo(ctrc.prazoPadraoData, ctrc.prazoPadraoDias, formatarData)}
            />
            <Campo rotulo="Entrega realizada" valor={formatarDataHora(ctrc.dataEntrega, fuso)} />
            {ctrc.dataPrevista &&
              ctrc.prazoPadraoData &&
              nasceuEmAtraso(ctrc.dataPrevista, ctrc.prazoPadraoData) && (
                <div className="flex items-start gap-2 border-t border-border/40 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Nascido em atraso — emitido a menos de 48 horas da previsão de entrega (
                    {formatarData(ctrc.dataPrevista)}); o mínimo seria{" "}
                    {formatarData(ctrc.prazoPadraoData)}. O atraso é do parceiro, não da {nomeCurto}
                    .
                  </span>
                </div>
              )}
          </Cartao>

          <Cartao titulo="Parceiro & Unidade">
            <Campo rotulo="Parceiro" valor={ctrc.parceiroNome ?? ctrc.parceiro?.nome ?? "—"} />
            <Campo
              rotulo="CNPJ"
              valor={formatarCnpjOuTraco(ctrc.parceiroCnpj ?? ctrc.parceiro?.cnpj ?? null)}
            />
            <Campo rotulo="Unidade" valor={ctrc.filial ?? "—"} />
            <Campo
              rotulo="Cidade da unidade"
              valor={
                ctrc.unidadeCidade
                  ? `${ctrc.unidadeCidade}${ctrc.unidadeUf ? `/${ctrc.unidadeUf}` : ""}`
                  : "—"
              }
            />
          </Cartao>

          <Cartao titulo="Performance">
            <Campo rotulo="Pontualidade" valor={<SeloDePontualidade ctrc={ctrc} />} />
            <Campo rotulo="Performance" valor={textoDaPerformance(ctrc.performanceDias)} />
            <Campo rotulo="Atraso" valor={textoDoAtraso(ctrc.atrasoDias)} />
            <Campo rotulo="Entrega realizada" valor={formatarDataHora(ctrc.dataEntrega, fuso)} />
            <Campo
              rotulo="Rota (origem → destino)"
              valor={
                ctrc.unidadeOrigem || ctrc.unidadeDestino
                  ? `${ctrc.unidadeOrigem ?? "—"} → ${ctrc.unidadeDestino ?? "—"}`
                  : "—"
              }
            />
            <Campo rotulo="Unidade atual" valor={ctrc.unidadeAtual ?? "—"} />
            <Campo rotulo="Fonte" valor={ctrc.fontePerformance ?? "—"} />
            <Campo
              rotulo="Última movimentação BI2"
              valor={
                ctrc.efetiva.dataHora ? (
                  <span className="inline-flex flex-col items-end">
                    <span>
                      {ctrc.efetiva.codigo !== null ? `${ctrc.efetiva.codigo} — ` : ""}
                      {ctrc.efetiva.descricao ?? "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatarDataHora(ctrc.efetiva.dataHora, fuso)} ·{" "}
                      {rotuloDaFonte(ctrc.efetiva.fonte)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            {ctrc.ocorrencias.length === 0 &&
              (ctrc.responsabilidadeCliente !== null || ctrc.dataEntrega) && (
                <div className="border-t border-border/40 bg-muted/30 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                  Classificação baseada no relatório de performance do SSW (0017) — nenhum evento
                  individual foi capturado para este CTRC via webhook.
                </div>
              )}
          </Cartao>

          <Cartao titulo="Enriquecimento">
            {ctrc.bi2 ? (
              <ol className="relative space-y-3 border-l border-border/70 px-3 py-3 pl-6">
                <li className="relative">
                  <span className="absolute top-0.5 -left-[13px] flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium">BI2 — dados operacionais</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatarDataHora(ctrc.bi2.atualizadoEm, fuso)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Relatório {ctrc.bi2.codigoRelatorio} · referência{" "}
                    {formatarData(ctrc.bi2.dataAlvo)}. Trouxe NF, peso, volumes, placas,
                    redespachante, cidade destino, valor do frete.
                  </p>
                </li>
              </ol>
            ) : (
              <div className="px-3 py-3 text-[12px] text-muted-foreground">
                Nenhum enriquecimento registrado ainda.
              </div>
            )}
          </Cartao>
        </div>
      </div>

      <section className="rounded-[10px] border border-border/70 bg-card">
        <header className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <h2 className="text-[13px] font-medium">Ocorrências</h2>
          <Selo variante="secundario" className="text-[10px]">
            {ctrc.ocorrencias.length}
          </Selo>
        </header>
        <ListaDeOcorrencias ocorrencias={ctrc.ocorrencias} fuso={fuso} />
      </section>

      <footer className="text-[11px] text-muted-foreground">
        Criado em {formatarDataHora(ctrc.criadoEm, fuso)} · atualizado em{" "}
        {formatarDataHora(ctrc.atualizadoEm, fuso)}
      </footer>
    </>
  );
}

// ---------------------------------------------------------------- peças

type Variante = "secundario" | "contorno" | "perigo" | "sucesso" | "atencao";

const SUCESSO =
  "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
const ATENCAO =
  "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300";

const VARIANTE: Record<Variante, { variant: BadgeProps["variant"]; className?: string }> = {
  secundario: { variant: "secondary" },
  contorno: { variant: "outline" },
  perigo: { variant: "destructive" },
  sucesso: { variant: "default", className: SUCESSO },
  atencao: { variant: "default", className: ATENCAO },
};

/** Selo de situação (verde/âmbar além das variantes do Badge, como hoje). */
function Selo({
  variante,
  className,
  children,
}: {
  variante: Variante;
  className?: string;
  children: ReactNode;
}) {
  const v = VARIANTE[variante];
  return (
    <Badge variant={v.variant} className={cn(v.className, className)}>
      {children}
    </Badge>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border/70 bg-card">
      <div className="border-b border-border/70 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {titulo}
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}

function CampoDeChave({ rotulo, chave }: { rotulo: string; chave: string }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="flex items-center gap-1 text-right">
        <span className="font-mono text-[10.5px] leading-tight break-all">
          {formatarChave(chave)}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(chave.replace(/\D/g, "")).then(() => {
              setCopiou(true);
              setTimeout(() => {
                setCopiou(false);
              }, 1500);
            });
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
          aria-label="Copiar chave"
          title="Copiar"
        >
          {copiou ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
      </span>
    </div>
  );
}

function SeloDeStatus({
  status,
  entregue,
  baixa,
}: {
  status: string | null;
  entregue: boolean;
  baixa: DetalheCtrc["finalizacao"]["baixa"];
}) {
  if (entregue) return <Selo variante="sucesso">Entregue</Selo>;
  if (baixa) {
    return (
      <Selo variante="secundario">
        Baixado sem entrega · {String(baixa.codigo).padStart(2, "0")}
        {baixa.descricao ? ` ${baixa.descricao}` : ""}
      </Selo>
    );
  }
  if (!status) return <Selo variante="contorno">Sem status</Selo>;
  return <Selo variante="secundario">{status}</Selo>;
}

function SeloDoPrazo({ ctrc, fuso }: { ctrc: DetalheCtrc; fuso: string }) {
  const s = statusDoPrazo(ctrc, new Date(), fuso);
  const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  switch (s.tipo) {
    case "sem_previsao":
      return <Selo variante="secundario">Sem previsão</Selo>;
    case "baixado":
      return <Selo variante="secundario">Baixado sem entrega</Selo>;
    case "entregue_no_prazo":
      return <Selo variante="sucesso">Entregue no prazo</Selo>;
    case "entregue_com_atraso":
      return <Selo variante="atencao">Entregue com {dias(s.dias)} de atraso</Selo>;
    case "no_prazo":
      return <Selo variante="sucesso">No prazo</Selo>;
    case "atrasado":
      return <Selo variante="perigo">Atrasado {dias(s.dias)}</Selo>;
  }
}

function SeloDePontualidade({ ctrc }: { ctrc: DetalheCtrc }) {
  const p = pontualidade({
    noPrazo: ctrc.noPrazo,
    responsabilidadeCliente: ctrc.responsabilidadeCliente,
    dataEntrega: ctrc.dataEntrega,
    baixado: ctrc.finalizacao.baixa !== null,
  });
  if (p === "responsabilidade_cliente") {
    return <Selo variante="contorno">Responsabilidade cliente</Selo>;
  }
  if (p === "baixado") {
    return <Selo variante="secundario">Baixado sem entrega — fora da pontualidade</Selo>;
  }
  if (p === "no_prazo") return <Selo variante="sucesso">No prazo</Selo>;
  if (p === "fora_do_prazo") return <Selo variante="perigo">Fora do prazo</Selo>;
  const emTransito = p === "em_transito";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Selo variante="secundario" className="cursor-help">
            {emTransito ? "Em trânsito — pontualidade não apurada" : "Pontualidade em apuração"}
          </Selo>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-[11px] leading-snug">
        {emTransito
          ? "A pontualidade é apurada depois da entrega, comparando a data de entrega com a previsão dos relatórios do SSW."
          : "A entrega já foi registrada; a pontualidade é recalculada pelos relatórios do SSW a cada 30 minutos. Se continuar assim, falta a previsão de entrega deste CT-e."}
      </TooltipContent>
    </Tooltip>
  );
}

function ItemDeOcorrencia({ o, fuso }: { o: OcorrenciaDoCtrc; fuso: string }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2 text-[12px]">
      <div className="mt-0.5">
        {o.penaliza ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">#{o.codigo}</span>
          <span className="font-medium">{o.descricao ?? "—"}</span>
          {o.penaliza && (
            <Selo variante="perigo" className="text-[10px]">
              penaliza
            </Selo>
          )}
          {o.responsavel && (
            <Selo variante="contorno" className="text-[10px]">
              {o.responsavel}
            </Selo>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {formatarDataHora(o.dataHora, fuso)}
        </div>
      </div>
    </li>
  );
}

function ListaDeOcorrencias({
  ocorrencias,
  fuso,
  className,
}: {
  ocorrencias: readonly OcorrenciaDoCtrc[];
  fuso: string;
  className?: string;
}) {
  if (ocorrencias.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
        Nenhuma ocorrência registrada.
      </div>
    );
  }
  return (
    <ol className={cn("divide-y divide-border/40", className)}>
      {ocorrencias.map((o) => (
        <ItemDeOcorrencia key={o.id} o={o} fuso={fuso} />
      ))}
    </ol>
  );
}

/** Olho que abre todas as ocorrências do CT-e num modal (só leitura). */
function JanelaDeOcorrencias({
  ocorrencias,
  numero,
  fuso,
}: {
  ocorrencias: readonly OcorrenciaDoCtrc[];
  numero: string;
  fuso: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]">
          <Eye className="h-3.5 w-3.5" />
          Visualizar
          <Selo variante="secundario" className="ml-0.5 h-4 px-1.5 text-[10px]">
            {ocorrencias.length}
          </Selo>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Ocorrências · CTRC {numero}</DialogTitle>
        </DialogHeader>
        <ListaDeOcorrencias
          ocorrencias={ocorrencias}
          fuso={fuso}
          className="max-h-[60vh] overflow-y-auto rounded-[10px] border border-border/70"
        />
      </DialogContent>
    </Dialog>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
