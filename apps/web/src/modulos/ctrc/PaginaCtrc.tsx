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
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  History,
  type LucideIcon,
  MapPin,
  Package,
  RefreshCw,
  SearchX,
  Truck,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { consultaAcesso } from "@/acesso/sessao";
import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { Pagina } from "@/componentes/layout/Pagina";
import { SeloDosDados } from "@/componentes/layout/SeloDosDados";
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
  const id = identificacao(ctrc?.numeroNf ?? null, ctrc?.numero ?? numero);

  return (
    <Pagina
      titulo={<Titulo rotulo={id.rotulo} principal={id.principal} />}
      descricao={
        <>
          {id.secundario ? `CTRC ${ctrc?.sigla ?? ""} ${id.secundario} · ` : ""}
          Detalhes do conhecimento de transporte
        </>
      }
      meta={<SeloDosDados className="" />}
      acoes={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              router.history.back();
            }}
          >
            <ArrowLeft aria-hidden /> Voltar
          </Button>
          {ssw && (
            <Button asChild size="sm" variant="outline">
              <a
                href={ssw}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir este CTRC no SSW"
              >
                <ExternalLink aria-hidden />
                Abrir no SSW
              </a>
            </Button>
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
            <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden /> Atualizar
          </Button>
        </>
      }
    >
      {isLoading && <Esqueleto />}

      {isError && (
        <Aviso
          tom="erro"
          titulo="Falha ao carregar CTRC."
          acao={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        />
      )}

      {data?.tipo === "nao_encontrado" && (
        <Painel>
          <EstadoVazio
            icone={SearchX}
            mensagem={`CTRC ${sigla ? `${sigla} ${numero}` : numero} não encontrado.`}
          />
        </Painel>
      )}

      {data?.tipo === "varios" && <EscolhaDeSerie numero={numero} opcoes={data.opcoes} />}

      {ctrc && <Detalhe ctrc={ctrc} nomeCurto={nomeCurto} fuso={fuso} />}
    </Pagina>
  );
}

function Titulo({ rotulo, principal }: { rotulo: "NF" | "CTRC"; principal: string }) {
  const semNf = rotulo === "CTRC";
  const classe = cn(
    "mr-2 align-middle text-[13px] font-semibold tracking-normal text-muted-foreground",
    semNf && "cursor-help underline decoration-dotted underline-offset-2",
  );
  return (
    <>
      {semNf ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={classe}>{rotulo}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Número da NF ainda não recebido. Ele vem do BI2 (relatório 0174), que roda em D-1. Assim
            que o próximo ciclo cobrir este CTRC, a NF aparece aqui automaticamente.
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className={classe}>{rotulo}</span>
      )}
      <span className="font-mono text-brand">{principal}</span>
    </>
  );
}

/** Q02: o mesmo número em mais de uma série — o operador escolhe qual abrir. */
function EscolhaDeSerie({ numero, opcoes }: { numero: string; opcoes: readonly OpcaoDeCtrc[] }) {
  return (
    <Painel
      titulo={`O número ${numero} existe em ${String(opcoes.length)} séries. Qual CT-e você quer abrir?`}
      icone={FileText}
    >
      <ul className="divide-y divide-border">
        {opcoes.map((o) => (
          <li key={`${o.sigla}-${o.numero}`}>
            <Link
              to="/ctrc/$numero"
              params={{ numero: o.numero }}
              search={{ sigla: o.sigla }}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px] transition-colors last:rounded-b-xl hover:bg-muted"
            >
              <span className="font-mono font-semibold text-brand">
                {o.sigla} {o.numero}
              </span>
              <span className="text-muted-foreground">Emissão {formatarData(o.dataEmissao)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{o.destinatario ?? "—"}</span>
              <span className="text-muted-foreground">{o.cidadeDestino ?? "—"}</span>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </Painel>
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
  const nascido =
    ctrc.dataPrevista &&
    ctrc.prazoPadraoData &&
    nasceuEmAtraso(ctrc.dataPrevista, ctrc.prazoPadraoData);

  return (
    <>
      {nascido && (
        <Aviso tom="alerta" titulo="Nascido em atraso">
          Emitido a menos de 48 horas da previsão de entrega ({formatarData(ctrc.dataPrevista)}); o
          mínimo seria {formatarData(ctrc.prazoPadraoData)}. O atraso é do parceiro, não da{" "}
          {nomeCurto}.
        </Aviso>
      )}

      <Painel classeDoCorpo="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 text-[13px]">
        <SeloDeStatus status={ctrc.statusAtual} entregue={entregue} baixa={baixa} />
        {ctrc.dataEntrega && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-status-good-fg">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Entregue em {formatarDataHora(ctrc.dataEntrega, fuso)}
          </span>
        )}
        {ctrc.dataPrevista && aberto && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            Prazo:{" "}
            <span className="font-semibold text-foreground">{formatarData(ctrc.dataPrevista)}</span>
            {ctrc.prazoOrigem && <Etiqueta>{ctrc.prazoOrigem}</Etiqueta>}
          </span>
        )}
      </Painel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Duas pilhas próprias (sem buraco entre cartões de alturas diferentes); no celular
            empilham: esquerda, depois direita. A linha do tempo fica ao lado em telas largas. */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Cartao titulo="Identificação" icone={FileText}>
              {ctrc.numeroNf !== null && (
                <Campo rotulo="Número NF">
                  <span className="font-mono">{ctrc.numeroNf}</span>
                </Campo>
              )}
              <Campo rotulo="Número CTRC">
                <span className="font-mono">
                  {ctrc.sigla} {ctrc.numero}
                </span>
              </Campo>
              <Campo rotulo="Emissão">{formatarData(ctrc.dataEmissao)}</Campo>
              <Campo rotulo="Embarque">{formatarData(ctrc.dataEmbarque)}</Campo>
              {ctrc.chave && <CampoDeChave rotulo="Chave CT-e" chave={ctrc.chave} />}
              {ctrc.chaveNfe && <CampoDeChave rotulo="Chave NF-e" chave={ctrc.chaveNfe} />}
            </Cartao>

            <Cartao titulo="Situação atual" icone={Truck}>
              <Campo rotulo="Status atual">{ctrc.statusAtual ?? "—"}</Campo>
              <Campo rotulo="Ocorrências">
                <JanelaDeOcorrencias
                  ocorrencias={ctrc.ocorrencias}
                  numero={ctrc.numero}
                  fuso={fuso}
                />
              </Campo>
              <Campo rotulo="Placa do veículo">
                {ctrc.placa ? (
                  <span className="font-mono">
                    {ctrc.placa}
                    {ctrc.romaneio && (
                      <span className="ml-1.5 font-sans text-[12.5px] text-muted-foreground">
                        · {ctrc.romaneio}
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </Campo>
              <Campo rotulo="Motorista">{ctrc.motorista ?? "—"}</Campo>
              <Campo rotulo="Localização" largo>
                {ctrc.localizacao ?? "—"}
              </Campo>
            </Cartao>

            <Cartao titulo="Remetente / Destinatário" icone={MapPin}>
              <Campo rotulo="Remetente" largo>
                {ctrc.remetente ?? "—"}
              </Campo>
              <Campo rotulo="Destinatário" largo>
                {ctrc.destinatario ?? "—"}
              </Campo>
              <div className="col-span-2 border-t border-border pt-3 text-[12.5px] font-semibold text-brand">
                Endereço de entrega
              </div>
              {temEndereco ? (
                <>
                  <Campo rotulo="Logradouro" largo>
                    {rua || "—"}
                  </Campo>
                  {complemento && <Campo rotulo="Complemento">{complemento}</Campo>}
                  {bairro && <Campo rotulo="Bairro">{bairro}</Campo>}
                  <Campo rotulo="Cidade / UF">{cidadeUf ?? "—"}</Campo>
                  {cep && (
                    <Campo rotulo="CEP">
                      <span className="font-mono">{formatarCep(cep)}</span>
                    </Campo>
                  )}
                </>
              ) : (
                <p className="col-span-2 text-[13px] text-muted-foreground">Não informado.</p>
              )}
            </Cartao>

            <Cartao titulo="Carga & Frete" icone={Package}>
              <Campo rotulo="Peso">
                {formatarPeso(ctrc.peso, { tonelada: 3, quilo: 3, fixas: true })}
              </Campo>
              <Campo rotulo="Volumes">{formatarInteiro(ctrc.volumes)}</Campo>
              <Campo rotulo="Valor do frete">{formatarMoeda(ctrc.valorFrete)}</Campo>
            </Cartao>
          </div>

          <div className="flex flex-col gap-4">
            <Cartao titulo="Prazos & Entrega" icone={CalendarClock}>
              <Campo rotulo="Prazo contratado">
                {ctrc.prazoContratadoDias !== null ? `${ctrc.prazoContratadoDias} dias` : "—"}
              </Campo>
              <Campo rotulo="Previsão de entrega">
                {ctrc.prazoFonte ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                        {formatarData(ctrc.dataPrevista)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      {origemDaPrevisao(ctrc.prazoFonte, ctrc.dataPrevista)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  formatarData(ctrc.dataPrevista)
                )}
              </Campo>
              <Campo rotulo="Status do prazo" largo>
                <SeloDoPrazo ctrc={ctrc} fuso={fuso} />
              </Campo>
              <Campo rotulo="Origem do prazo">{ctrc.prazoOrigem ?? "—"}</Campo>
              <Campo rotulo="Prazo mínimo (48h)" largo>
                {textoDoPrazoMinimo(ctrc.prazoPadraoData, ctrc.prazoPadraoDias, formatarData)}
              </Campo>
              <Campo rotulo="Entrega realizada">{formatarDataHora(ctrc.dataEntrega, fuso)}</Campo>
            </Cartao>

            <Cartao titulo="Parceiro & Unidade" icone={Building2}>
              <Campo rotulo="Parceiro" largo>
                {ctrc.parceiroNome ?? ctrc.parceiro?.nome ?? "—"}
              </Campo>
              <Campo rotulo="CNPJ">
                <span className="tabular-nums">
                  {formatarCnpjOuTraco(ctrc.parceiroCnpj ?? ctrc.parceiro?.cnpj ?? null)}
                </span>
              </Campo>
              <Campo rotulo="Unidade">{ctrc.filial ?? "—"}</Campo>
              <Campo rotulo="Cidade da unidade">
                {ctrc.unidadeCidade
                  ? `${ctrc.unidadeCidade}${ctrc.unidadeUf ? `/${ctrc.unidadeUf}` : ""}`
                  : "—"}
              </Campo>
            </Cartao>

            <Cartao
              titulo="Performance"
              icone={Gauge}
              rodape={
                ctrc.ocorrencias.length === 0 &&
                (ctrc.responsabilidadeCliente !== null || ctrc.dataEntrega) &&
                "Classificação baseada no relatório de performance do SSW (0017) — nenhum evento individual foi capturado para este CTRC via webhook."
              }
            >
              <Campo rotulo="Pontualidade" largo>
                <SeloDePontualidade ctrc={ctrc} />
              </Campo>
              <Campo rotulo="Performance">{textoDaPerformance(ctrc.performanceDias)}</Campo>
              <Campo rotulo="Atraso">{textoDoAtraso(ctrc.atrasoDias)}</Campo>
              <Campo rotulo="Entrega realizada">{formatarDataHora(ctrc.dataEntrega, fuso)}</Campo>
              <Campo rotulo="Rota (origem → destino)">
                {ctrc.unidadeOrigem || ctrc.unidadeDestino
                  ? `${ctrc.unidadeOrigem ?? "—"} → ${ctrc.unidadeDestino ?? "—"}`
                  : "—"}
              </Campo>
              <Campo rotulo="Unidade atual">{ctrc.unidadeAtual ?? "—"}</Campo>
              <Campo rotulo="Fonte">{ctrc.fontePerformance ?? "—"}</Campo>
              <Campo rotulo="Última movimentação BI2" largo>
                {ctrc.efetiva.dataHora ? (
                  <span className="flex flex-col">
                    <span>
                      {ctrc.efetiva.codigo !== null ? `${ctrc.efetiva.codigo} — ` : ""}
                      {ctrc.efetiva.descricao ?? "—"}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {formatarDataHora(ctrc.efetiva.dataHora, fuso)} ·{" "}
                      {rotuloDaFonte(ctrc.efetiva.fonte)}
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </Campo>
            </Cartao>

            <Painel titulo="Enriquecimento" icone={Database} classeDoCorpo="px-5 py-4">
              {ctrc.bi2 ? (
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-status-good/40 bg-status-good-bg text-status-good-fg">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[13px] font-semibold">BI2 — dados operacionais</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatarDataHora(ctrc.bi2.atualizadoEm, fuso)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                      Relatório {ctrc.bi2.codigoRelatorio} · referência{" "}
                      {formatarData(ctrc.bi2.dataAlvo)}. Trouxe NF, peso, volumes, placas,
                      redespachante, cidade destino, valor do frete.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Nenhum enriquecimento registrado ainda.
                </p>
              )}
            </Painel>
          </div>
        </div>

        <Painel
          titulo="Ocorrências"
          icone={History}
          acoes={<Contagem>{ctrc.ocorrencias.length}</Contagem>}
          classeDoCorpo="px-5 py-4"
          className="xl:sticky xl:top-6"
        >
          <LinhaDoTempo ocorrencias={ctrc.ocorrencias} fuso={fuso} />
        </Painel>
      </div>

      <p className="text-xs text-muted-foreground">
        Criado em {formatarDataHora(ctrc.criadoEm, fuso)} · atualizado em{" "}
        {formatarDataHora(ctrc.atualizadoEm, fuso)}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- peças

/** Painel de um grupo de campos: rótulo em caixa alta sobre o valor, em duas colunas. */
function Cartao({
  titulo,
  icone,
  rodape,
  children,
}: {
  titulo: string;
  icone: LucideIcon;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Painel
      titulo={titulo}
      icone={icone}
      rodape={rodape && <p className="text-[12.5px] leading-snug">{rodape}</p>}
    >
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 py-4">{children}</dl>
    </Painel>
  );
}

/** Um campo do cartão; `largo` ocupa as duas colunas (nomes, endereço, textos longos). */
function Campo({
  rotulo,
  largo,
  children,
}: {
  rotulo: string;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", largo && "col-span-2")}>
      <dt className="label-xs">{rotulo}</dt>
      <dd className="mt-1 text-[13px] break-words text-foreground">{children}</dd>
    </div>
  );
}

function CampoDeChave({ rotulo, chave }: { rotulo: string; chave: string }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <Campo rotulo={rotulo} largo>
      <span className="flex items-start gap-2">
        <span className="font-mono text-[12.5px] leading-relaxed break-all">
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
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copiar chave"
          title="Copiar"
        >
          {copiou ? (
            <Check className="h-3.5 w-3.5 text-status-good-fg" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </span>
    </Campo>
  );
}

/** Texto curto sem situação (origem do prazo, responsável da ocorrência). */
function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <SeloStatus tom="neutro" semIcone>
      {children}
    </SeloStatus>
  );
}

function Contagem({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-[12px] font-semibold text-muted-foreground tabular-nums">
      {children}
    </span>
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
  if (entregue) return <SeloStatus tom="sucesso">Entregue</SeloStatus>;
  if (baixa) {
    return (
      <SeloStatus tom="neutro">
        Baixado sem entrega · {String(baixa.codigo).padStart(2, "0")}
        {baixa.descricao ? ` ${baixa.descricao}` : ""}
      </SeloStatus>
    );
  }
  if (!status) return <SeloStatus tom="neutro">Sem status</SeloStatus>;
  return (
    <SeloStatus tom="info" icone={Truck}>
      {status}
    </SeloStatus>
  );
}

function SeloDoPrazo({ ctrc, fuso }: { ctrc: DetalheCtrc; fuso: string }) {
  const s = statusDoPrazo(ctrc, new Date(), fuso);
  const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  const selo = (tom: Tom, texto: string) => <SeloStatus tom={tom}>{texto}</SeloStatus>;
  switch (s.tipo) {
    case "sem_previsao":
      return selo("neutro", "Sem previsão");
    case "baixado":
      return selo("neutro", "Baixado sem entrega");
    case "entregue_no_prazo":
      return selo("sucesso", "Entregue no prazo");
    case "entregue_com_atraso":
      return selo("alerta", `Entregue com ${dias(s.dias)} de atraso`);
    case "no_prazo":
      return selo("sucesso", "No prazo");
    case "atrasado":
      return selo("erro", `Atrasado ${dias(s.dias)}`);
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
    return <SeloStatus tom="info">Responsabilidade cliente</SeloStatus>;
  }
  if (p === "baixado") {
    return <SeloStatus tom="neutro">Baixado sem entrega — fora da pontualidade</SeloStatus>;
  }
  if (p === "no_prazo") return <SeloStatus tom="sucesso">No prazo</SeloStatus>;
  if (p === "fora_do_prazo") return <SeloStatus tom="erro">Fora do prazo</SeloStatus>;
  const emTransito = p === "em_transito";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex max-w-full cursor-help rounded-full">
          <SeloStatus tom="neutro" icone={Clock}>
            {emTransito ? "Em trânsito — pontualidade não apurada" : "Pontualidade em apuração"}
          </SeloStatus>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs leading-snug">
        {emTransito
          ? "A pontualidade é apurada depois da entrega, comparando a data de entrega com a previsão dos relatórios do SSW."
          : "A entrega já foi registrada; a pontualidade é recalculada pelos relatórios do SSW a cada 30 minutos. Se continuar assim, falta a previsão de entrega deste CT-e."}
      </TooltipContent>
    </Tooltip>
  );
}

/** Ocorrências na ordem recebida, ligadas por um trilho; as que penalizam em destaque. */
function LinhaDoTempo({
  ocorrencias,
  fuso,
}: {
  ocorrencias: readonly OcorrenciaDoCtrc[];
  fuso: string;
}) {
  if (ocorrencias.length === 0) {
    return (
      <EstadoVazio className="py-6" icone={History} mensagem="Nenhuma ocorrência registrada." />
    );
  }
  return (
    <ol>
      {ocorrencias.map((o, i) => (
        <li key={o.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < ocorrencias.length - 1 && (
            <span
              aria-hidden
              className="absolute top-9 bottom-1 left-[15px] w-0.5 rounded-full bg-muted-foreground/35"
            />
          )}
          <span
            aria-hidden
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              o.penaliza
                ? "border-status-bad/40 bg-status-bad-bg text-status-bad-fg"
                : "border-border bg-superficie text-muted-foreground",
            )}
          >
            {o.penaliza ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="text-[13px] font-semibold text-foreground">{o.descricao ?? "—"}</div>
            <time
              dateTime={o.dataHora}
              className="mt-0.5 block text-[12.5px] text-muted-foreground tabular-nums"
            >
              {formatarDataHora(o.dataHora, fuso)}
            </time>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                #{o.codigo}
              </span>
              {o.penaliza && <SeloStatus tom="erro">penaliza</SeloStatus>}
              {o.responsavel && <Etiqueta>{o.responsavel}</Etiqueta>}
            </div>
          </div>
        </li>
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
        <Button variant="outline" size="sm" className="h-8">
          <Eye aria-hidden />
          Visualizar
          <Contagem>{ocorrencias.length}</Contagem>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold">Ocorrências · CTRC {numero}</DialogTitle>
        </DialogHeader>
        <div className="rolagem-fina max-h-[60vh] overflow-y-auto rounded-xl border border-border px-4 py-4">
          <LinhaDoTempo ocorrencias={ocorrencias} fuso={fuso} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-14 w-full rounded-2xl bg-muted" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl bg-muted" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
