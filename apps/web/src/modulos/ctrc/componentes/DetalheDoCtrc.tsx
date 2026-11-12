import { type DetalheCtrc } from "@erp/shared/contratos/ctrc";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPeso,
} from "@erp/shared/formatacao";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  History,
  MapPin,
  Package,
  Truck,
} from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { Painel } from "@/componentes/comum/Painel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/componentes/ui/tooltip";

import {
  formatarCep,
  formatarCnpjOuTraco,
  nasceuEmAtraso,
  origemDaPrevisao,
  rotuloDaFonte,
  textoDaPerformance,
  textoDoAtraso,
  textoDoPrazoMinimo,
} from "../textos";
import { Campo } from "./Campo";
import { CampoDeChave } from "./CampoDeChave";
import { Cartao } from "./Cartao";
import { Contagem } from "./Contagem";
import { Etiqueta } from "./Etiqueta";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { ModalDeOcorrencias } from "./ModalDeOcorrencias";
import { PainelDeEnriquecimento } from "./PainelDeEnriquecimento";
import { SeloDePontualidade } from "./SeloDePontualidade";
import { SeloDeStatus } from "./SeloDeStatus";
import { SeloDoPrazo } from "./SeloDoPrazo";

export function DetalheDoCtrc({
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
                <ModalDeOcorrencias
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

            <PainelDeEnriquecimento bi2={ctrc.bi2} fuso={fuso} />
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
