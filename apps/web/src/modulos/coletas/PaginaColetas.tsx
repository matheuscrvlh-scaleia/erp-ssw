import {
  type LinhaDeColeta,
  type PainelDeColetas,
  STATUS_DA_LISTA,
  type StatusDaLista,
  type TotaisDeColetas,
} from "@erp/shared/contratos/coletas";
import { hojeNoFuso } from "@erp/shared/datas";
import {
  formatarData,
  formatarDataHora,
  formatarDiaMes,
  formatarInteiro,
  formatarParticipacao,
} from "@erp/shared/formatacao";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlarmClockOff,
  Ban,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ChartColumnStacked,
  FileText,
  FileUp,
  Hourglass,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { CampoDetalhe, DrawerDetalhe, GradeDetalhe } from "@/componentes/comum/Detalhe";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { resolverPeriodo } from "@/componentes/comum/periodo";
import { SeloAtualizacao } from "@/componentes/comum/SeloAtualizacao";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { temFiltro } from "@/hooks/filtros-na-url";
import { useFiltrosNaUrl } from "@/hooks/use-filtros-na-url";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { BuscaDocumento } from "@/modulos/filtros/componentes";

import { carregarListaInteira, consultaDetalhe, consultaLista, consultaPainel } from "./api";
import {
  alternar,
  ATALHOS_DE_COLETAS,
  type BuscaColetas,
  esquemaDaBusca,
  etiquetasDaBusca,
  filtrosDaBusca,
  ROTULO_DO_PRAZO,
  ROTULO_DO_STATUS,
  SEM_SOLICITANTE,
} from "./busca";
import { Importador050 } from "./Importador050";

const TAMANHO_DA_PAGINA = 50;

const OPCOES_DE_TIPO = [
  { valor: "", rotulo: "Normal e reversa" },
  { valor: "NORMAL", rotulo: "Só normal" },
  { valor: "REVERSA", rotulo: "Só reversa" },
] as const satisfies readonly { valor: BuscaColetas["tipo"]; rotulo: string }[];

interface Cartao {
  status: StatusDaLista;
  rotulo: string;
  valor: (t: TotaisDeColetas) => number;
  detalhe: (t: TotaisDeColetas) => string;
  dica: string;
  tom: StatusKpi;
  icone: LucideIcon;
}

const CARTOES: Cartao[] = [
  {
    status: "todas",
    icone: Boxes,
    rotulo: "Coletas",
    valor: (t) => t.total,
    detalhe: (t) => `${formatarInteiro(t.reversas)} reversa(s)`,
    dica: "Coletas cadastradas no período (data de cadastro no SSW), em qualquer situação.",
    tom: "bom",
  },
  {
    status: "no_prazo",
    icone: CalendarCheck,
    rotulo: "Coletadas no prazo",
    valor: (t) => t.noPrazo,
    detalhe: (t) =>
      `${formatarParticipacao(t.noPrazo, t.coletadas)} das ${formatarInteiro(t.coletadas)} coletadas`,
    dica: "Coletadas até a data/hora limite atual da coleta. É a mesma conta do quadro RESUMO do relatório 050 do SSW.",
    tom: "bom",
  },
  {
    status: "atrasadas",
    icone: CalendarX,
    rotulo: "Coletadas atrasadas",
    valor: (t) => t.atrasadas,
    detalhe: (t) => `${formatarParticipacao(t.atrasadas, t.coletadas)} das coletadas`,
    dica: "Coletadas depois da data/hora limite atual. Coleta com prazo alterado no SSW conta pelo prazo novo, como no próprio SSW.",
    tom: "ruim",
  },
  {
    status: "abertas",
    icone: Hourglass,
    rotulo: "Em aberto",
    valor: (t) => t.abertas,
    detalhe: (t) =>
      `${formatarInteiro(t.cadastradas)} cadastradas · ${formatarInteiro(t.comandadas)} comandadas`,
    dica: "Ainda não coletadas nem canceladas, na última posição recebida do SSW.",
    tom: "alerta",
  },
  {
    status: "vencidas",
    icone: AlarmClockOff,
    rotulo: "Vencidas",
    valor: (t) => t.vencidas,
    detalhe: () => "Em aberto com o limite já passado",
    dica: "Coletas em aberto cuja data/hora limite já passou.",
    tom: "ruim",
  },
  {
    status: "vence_hoje",
    icone: CalendarClock,
    rotulo: "Vencem hoje",
    valor: (t) => t.venceHoje,
    detalhe: (t) => `${formatarInteiro(t.aVencer)} a vencer depois de hoje`,
    dica: "Coletas em aberto com data limite hoje, ainda dentro do horário.",
    tom: "alerta",
  },
  {
    status: "com_ctrc",
    icone: FileText,
    rotulo: "Com CT-e gerado",
    valor: (t) => t.comCtrc,
    detalhe: (t) => `${formatarParticipacao(t.comCtrc, t.coletadas)} das coletadas`,
    dica: "Coletas em que o SSW registrou 'CTRC GERADO' no histórico: o subcontrato que nasceu da coleta.",
    tom: "bom",
  },
  {
    status: "canceladas",
    icone: Ban,
    rotulo: "Canceladas",
    valor: (t) => t.canceladas,
    detalhe: (t) => `${formatarInteiro(t.prejudicadas)} prejudicada(s) pelo horário`,
    dica: "Coletas canceladas no SSW, mesmo que tenham sido coletadas antes. Não entram na conta de prazo.",
    tom: "ruim",
  },
];

const ETAPA: Record<LinhaDeColeta["etapa"], string> = {
  cadastrada: "Cadastrada",
  comandada: "Comandada",
  coletada: "Coletada",
  cancelada: "Cancelada",
};

function colunasDaLista(fuso: string): ColunaTabela<LinhaDeColeta>[] {
  const dh = (v: string | null) => formatarDataHora(v, fuso);
  return [
    { chave: "unidade", titulo: "Unidade", classe: "font-mono", fixa: true },
    { chave: "numero", titulo: "Coleta", classe: "font-mono whitespace-nowrap" },
    { chave: "tipo", titulo: "Tipo" },
    { chave: "etapa", titulo: "Situação", valor: (l) => ETAPA[l.etapa] },
    {
      chave: "statusPrazo",
      titulo: "Prazo",
      valor: (l) => ROTULO_DO_PRAZO[l.statusPrazo].texto,
      celula: (l) => (
        <SeloStatus tom={ROTULO_DO_PRAZO[l.statusPrazo].tom}>
          {ROTULO_DO_PRAZO[l.statusPrazo].texto}
        </SeloStatus>
      ),
    },
    {
      chave: "cadastradaEm",
      titulo: "Cadastro",
      formato: "datahora",
      celula: (l) => dh(l.cadastradaEm),
    },
    { chave: "limiteEm", titulo: "Limite", formato: "datahora", celula: (l) => dh(l.limiteEm) },
    {
      chave: "coletadaEm",
      titulo: "Coletada em",
      formato: "datahora",
      celula: (l) => dh(l.coletadaEm),
    },
    { chave: "canceladaEm", titulo: "Cancelada em", formato: "datahora", oculta: true },
    { chave: "solicitante", titulo: "Solicitante", classe: "max-w-[160px] truncate" },
    { chave: "remetenteCnpj", titulo: "CNPJ remetente", oculta: true },
    { chave: "remetenteNome", titulo: "Remetente", classe: "max-w-[200px] truncate" },
    { chave: "remetenteCidade", titulo: "Cidade coleta" },
    { chave: "destinatarioNome", titulo: "Destinatário", oculta: true },
    { chave: "destinoCidade", titulo: "Destino", oculta: true },
    { chave: "motorista", titulo: "Motorista", oculta: true },
    { chave: "placa", titulo: "Placa", classe: "font-mono" },
    { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
    { chave: "pesoKg", titulo: "Peso (kg)", formato: "decimal" },
    { chave: "valorMercadoria", titulo: "Valor mercadoria", formato: "moeda", oculta: true },
    { chave: "tipoFrete", titulo: "Frete", oculta: true },
    { chave: "notasFiscais", titulo: "Notas fiscais", oculta: true },
    {
      chave: "cte",
      titulo: "CT-e gerado",
      valor: (l) => (l.cteNumero ? `${l.cteSigla ?? ""} ${l.cteNumero}`.trim() : null),
      classe: "font-mono",
    },
    { chave: "cteTipoDocumento", titulo: "Tipo do CT-e", oculta: true },
    {
      chave: "prejudicadaHorario",
      titulo: "Prejudicada pelo horário",
      oculta: true,
      valor: (l) => (l.prejudicadaHorario ? "Sim" : null),
    },
    { chave: "ultimoEvento", titulo: "Último evento", classe: "max-w-[220px] truncate" },
  ];
}

function DetalheDaColeta({ coleta, fuso }: { coleta: LinhaDeColeta; fuso: string }) {
  const detalhe = useQuery(consultaDetalhe(coleta.unidade, coleta.numero));
  const d = detalhe.data;
  return (
    <>
      <GradeDetalhe>
        <CampoDetalhe rotulo="Situação" valor={ETAPA[coleta.etapa]} />
        <CampoDetalhe rotulo="Prazo" valor={ROTULO_DO_PRAZO[coleta.statusPrazo].texto} />
        <CampoDetalhe rotulo="Cadastro" valor={formatarDataHora(coleta.cadastradaEm, fuso)} />
        <CampoDetalhe rotulo="Cadastrada por" valor={d?.cadastradaPor ?? null} />
        <CampoDetalhe
          rotulo="Comandada em"
          valor={d ? formatarDataHora(d.comandadaEm, fuso) : null}
        />
        <CampoDetalhe rotulo="Limite" valor={formatarDataHora(coleta.limiteEm, fuso)} />
        <CampoDetalhe
          rotulo="Limite inicial"
          valor={d ? formatarDataHora(d.limiteInicial, fuso) : null}
        />
        <CampoDetalhe rotulo="Coletada em" valor={formatarDataHora(coleta.coletadaEm, fuso)} />
        <CampoDetalhe rotulo="Solicitante" valor={coleta.solicitante} />
        <CampoDetalhe rotulo="Remetente" valor={coleta.remetenteNome} />
        <CampoDetalhe rotulo="Cidade coleta" valor={coleta.remetenteCidade} />
        <CampoDetalhe rotulo="Destino" valor={coleta.destinoCidade} />
        <CampoDetalhe rotulo="Motorista" valor={coleta.motorista} />
        <CampoDetalhe rotulo="Placa" valor={coleta.placa} />
        <CampoDetalhe rotulo="Setor" valor={d?.setor ?? null} />
        <CampoDetalhe rotulo="Romaneio" valor={d?.romaneio ?? null} />
        <CampoDetalhe rotulo="Mercadoria" valor={d?.mercadoria ?? null} />
        <CampoDetalhe
          rotulo="CT-e gerado"
          valor={coleta.cteNumero ? `${coleta.cteSigla ?? ""} ${coleta.cteNumero}`.trim() : null}
        />
      </GradeDetalhe>
      {d?.observacao && (
        <p className="rounded-lg bg-muted p-3 text-[13px] whitespace-pre-line">{d.observacao}</p>
      )}
      <section>
        <h3 className="label-xs mb-2">Histórico no SSW</h3>
        {detalhe.isLoading && <p className="text-[13px] text-muted-foreground">Carregando…</p>}
        {detalhe.error && <MensagemErro erro={detalhe.error} />}
        <ol className="space-y-2 text-[13px]">
          {d?.historico.map((e, i) => (
            <li key={i} className="border-l-2 border-brand/40 pl-3">
              <span className="text-xs text-muted-foreground">
                {formatarDataHora(e.em, fuso)} · {e.unidade} · {e.usuario}
              </span>
              <p>{e.texto}</p>
            </li>
          ))}
        </ol>
        {d && (
          <p className="mt-3 text-xs text-muted-foreground">
            Posição do relatório 050 de {formatarDataHora(d.relatorioEmitidoEm, fuso)}
          </p>
        )}
      </section>
    </>
  );
}

export function PaginaColetas() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const podeImportar = pode(acesso, "coletas", "editar");
  const { filtros: busca, definir, limpar, ativos } = useFiltrosNaUrl(esquemaDaBusca);
  const periodo = resolverPeriodo(busca.periodo, busca.de, busca.ate, hojeNoFuso(fuso), "30d");
  const filtros = filtrosDaBusca(busca, periodo);
  const subtitulo = `Cadastro de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`;

  const [importando, setImportando] = useState(false);
  const [aberta, setAberta] = useState<LinhaDeColeta | null>(null);
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const painel = useQuery(consultaPainel(filtros));
  const lista = useQuery({
    ...consultaLista(filtros, {
      status: busca.status,
      busca: termo,
      pagina,
      tamanho: TAMANHO_DA_PAGINA,
    }),
    placeholderData: keepPreviousData,
  });
  const mudar = (m: Partial<BuscaColetas>) => {
    setPagina(1);
    definir(m);
  };
  const d: PainelDeColetas | undefined = painel.data;

  const atualizando = painel.isFetching;
  const unidades = d?.opcoes.unidades ?? [];

  return (
    <Pagina
      titulo="Coletas"
      descricao={
        <>
          Ordens de coleta do SSW (relatório 050)
          {d?.cobertura.inicio && d.cobertura.fim && (
            <>
              {" "}
              · coletas importadas de {formatarData(d.cobertura.inicio)} a{" "}
              {formatarData(d.cobertura.fim)}
            </>
          )}
        </>
      }
      meta={d && <SeloAtualizacao atualizadoEm={d.posicaoEm} fuso={fuso} />}
      acoes={
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={atualizando}
            onClick={() => {
              void painel.refetch();
              void lista.refetch();
            }}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} aria-hidden />
            Atualizar
          </Button>
          {podeImportar && (
            <Button
              size="sm"
              onClick={() => {
                setImportando(true);
              }}
            >
              <FileUp aria-hidden />
              Importar 050
            </Button>
          )}
        </>
      }
      filtros={
        <>
          <FiltrosAvancados
            ativos={temFiltro(ativos, busca.periodo)}
            aoLimpar={() => {
              setPagina(1);
              limpar(busca.periodo === "custom" ? [] : ["periodo"]);
            }}
          >
            <FiltroPeriodo
              periodo={busca.periodo}
              de={busca.de}
              ate={busca.ate}
              atalhos={ATALHOS_DE_COLETAS}
              padrao="30d"
              rotulo="Cadastro"
              aoMudar={mudar}
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              por data de cadastro
              <InfoTip texto="O período filtra pela data em que a coleta foi cadastrada no SSW, a mesma do 'período de cadastramento' da opção 050." />
            </span>
            {unidades.length > 1 && (
              <FiltroMultiplo
                rotulo="Unidade"
                opcoes={unidades.map((u) => ({ valor: u }))}
                selecionados={busca.unidades}
                busca={false}
                monoespacado
                aoMudar={(selecionadas) => {
                  mudar({ unidades: selecionadas });
                }}
              />
            )}
            <Alternador
              rotulo="Tipo de coleta"
              opcoes={OPCOES_DE_TIPO}
              valor={busca.tipo}
              aoMudar={(tipo) => {
                mudar({ tipo });
              }}
            />
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetasQueLimpam(etiquetasDaBusca(busca), mudar)} />
        </>
      }
    >
      {painel.isError && (
        <MensagemErro
          erro={painel.error}
          titulo="Não foi possível carregar as coletas"
          aoTentarDeNovo={() => {
            void painel.refetch();
          }}
        />
      )}
      {d && d.posicaoEm === null && (
        <Aviso tom="info" titulo="Nenhuma coleta importada ainda.">
          {podeImportar
            ? "Importe o relatório 050 pelo botão “Importar 050”."
            : "Peça a um administrador para importar o relatório 050."}
        </Aviso>
      )}

      {!painel.isError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {CARTOES.map((c) => (
              <KpiCard
                key={c.status}
                rotulo={c.rotulo}
                valor={d ? formatarInteiro(c.valor(d.totais)) : "—"}
                detalhe={d ? c.detalhe(d.totais) : c.dica}
                status={c.tom}
                neutro={c.status === "todas"}
                icone={c.icone}
                ativo={busca.status === c.status && c.status !== "todas"}
                aoClicar={() => {
                  mudar({ status: busca.status === c.status ? "todas" : c.status });
                }}
              />
            ))}
          </div>

          <Painel titulo="Coletas por dia de cadastro" icone={ChartColumnStacked}>
            <GraficoBarras
              descricao="Coletas por dia de cadastro"
              dados={(d?.porDia ?? []).map((p) => ({
                ...p,
                rotulo: formatarDiaMes(p.dia),
                demais: p.total - p.noPrazo - p.atrasadas,
              }))}
              eixoX="rotulo"
              formato="inteiro"
              carregando={painel.isLoading}
              series={[
                {
                  chave: "noPrazo",
                  nome: "Coletadas no prazo",
                  cor: "var(--status-good)",
                  pilha: "a",
                },
                {
                  chave: "atrasadas",
                  nome: "Coletadas atrasadas",
                  cor: "var(--status-bad)",
                  pilha: "a",
                },
                {
                  chave: "demais",
                  nome: "Em aberto ou canceladas",
                  cor: "var(--grafico-comparacao)",
                  pilha: "a",
                },
              ]}
            />
          </Painel>

          <div className="grid items-start gap-4 xl:grid-cols-3">
            <TabelaDados
              className="xl:col-span-2"
              titulo="Coletas por solicitante"
              colunas={[
                {
                  chave: "solicitante",
                  titulo: "Solicitante",
                  valor: (l) => l.solicitante || SEM_SOLICITANTE,
                },
                { chave: "total", titulo: "Coletas", formato: "inteiro" },
                { chave: "coletadas", titulo: "Coletadas", formato: "inteiro" },
                { chave: "noPrazo", titulo: "No prazo", formato: "inteiro" },
                { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
                { chave: "abertas", titulo: "Em aberto", formato: "inteiro" },
              ]}
              linhas={d?.porSolicitante ?? []}
              chaveDaLinha={(l) => l.solicitante}
              carregando={painel.isLoading}
              porPagina={10}
              aoClicarLinha={(l) => {
                mudar({ solicitantes: alternar(busca.solicitantes, l.solicitante) });
              }}
              exportacao={{
                arquivo: "coletas-por-solicitante",
                titulo: "Coletas por solicitante",
                subtitulo,
              }}
            />
            <TabelaDados
              titulo="CT-e gerado pela coleta, por tipo de documento"
              colunas={[
                { chave: "tipoDocumento", titulo: "Tipo de documento" },
                { chave: "coletas", titulo: "Coletas", formato: "inteiro" },
                { chave: "ctes", titulo: "CT-e", formato: "inteiro" },
              ]}
              linhas={d?.porTipoCtrc ?? []}
              chaveDaLinha={(l) => l.tipoDocumento}
              carregando={painel.isLoading}
              porPagina={0}
            />
          </div>
          <TabelaDados
            titulo="Por unidade"
            colunas={[
              { chave: "unidade", titulo: "Unidade", classe: "font-mono" },
              { chave: "total", titulo: "Coletas", formato: "inteiro" },
              { chave: "coletadas", titulo: "Coletadas", formato: "inteiro" },
              { chave: "noPrazo", titulo: "No prazo", formato: "inteiro" },
              { chave: "atrasadas", titulo: "Atrasadas", formato: "inteiro" },
              {
                chave: "pctNoPrazo",
                titulo: "% no prazo",
                formato: "percentual",
                valor: (l) => (l.coletadas > 0 ? l.noPrazo / l.coletadas : null),
              },
              { chave: "abertas", titulo: "Em aberto", formato: "inteiro" },
              { chave: "vencidas", titulo: "Vencidas", formato: "inteiro" },
              { chave: "canceladas", titulo: "Canceladas", formato: "inteiro" },
            ]}
            linhas={d?.porUnidade ?? []}
            chaveDaLinha={(l) => l.unidade}
            carregando={painel.isLoading}
            porPagina={0}
            exportacao={{
              arquivo: "coletas-por-unidade",
              titulo: "Coletas por unidade",
              subtitulo,
            }}
          />
        </>
      )}

      <TabelaDados
        titulo="Detalhe das coletas"
        colunas={colunasDaLista(fuso)}
        linhas={lista.data?.linhas ?? []}
        chaveDaLinha={(l) => `${l.unidade}-${String(l.numero)}`}
        carregando={lista.isLoading}
        erro={lista.error}
        aoTentarDeNovo={() => {
          void lista.refetch();
        }}
        mensagemVazia="Nenhuma coleta encontrada."
        aoClicarLinha={setAberta}
        linhaAtiva={aberta ? `${aberta.unidade}-${String(aberta.numero)}` : null}
        configurarColunas
        paginacaoServidor={{
          pagina,
          porPagina: TAMANHO_DA_PAGINA,
          total: lista.data?.total ?? 0,
          aoMudarPagina: setPagina,
        }}
        rotuloTotal={(n) => `${formatarInteiro(n)} coleta(s)`}
        exportacao={{
          arquivo: `coletas-${busca.status}`,
          titulo: `Coletas — ${ROTULO_DO_STATUS[busca.status]}`,
          subtitulo,
          carregarLinhas: () => carregarListaInteira(filtros, busca.status, termo),
        }}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={busca.status}
              onValueChange={(v) => {
                mudar({ status: STATUS_DA_LISTA.find((s) => s === v) ?? "todas" });
              }}
            >
              <SelectTrigger className="h-9 w-[210px] text-[13px]" aria-label="Situação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_DA_LISTA.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">
                    {ROTULO_DO_STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BuscaDocumento
              valor={termo}
              placeholder="Coleta, CT-e, NF, remetente…"
              className="w-[240px]"
              aoMudar={(t) => {
                setPagina(1);
                setTermo(t);
              }}
            />
          </div>
        }
      />

      <DrawerDetalhe
        aberto={aberta !== null}
        aoFechar={() => {
          setAberta(null);
        }}
        titulo={aberta ? `Coleta ${aberta.unidade} ${String(aberta.numero)}` : ""}
        descricao={
          aberta?.cadastradaEm
            ? `Cadastro ${formatarDataHora(aberta.cadastradaEm, fuso)}`
            : undefined
        }
      >
        {aberta && <DetalheDaColeta coleta={aberta} fuso={fuso} />}
      </DrawerDetalhe>

      {podeImportar && (
        <Importador050 aberto={importando} aoMudarAberto={setImportando} fuso={fuso} />
      )}
    </Pagina>
  );
}
