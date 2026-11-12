import {
  type AcaoEmLote,
  ACOES_EM_LOTE,
  type CodigoDoAdmin,
  contratosCodigosOcorrencia as c,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Hourglass, Inbox, ListChecks, Plus, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { BuscaNaBarra, Escolha } from "@/modulos/admin/comum";

import { CHAVE_DOS_CODIGOS, consultaCodigos } from "./api";
import { type CodigoParaSalvar, ModalDoCodigo } from "./ModalDoCodigo";
import {
  ehLetra,
  filtrarCodigos,
  FILTROS_INICIAIS,
  type FiltrosDosCodigos,
  ORDENS,
  rotulosDaLetra,
} from "./regras";

const ROTULO_DA_ORDEM = {
  codigo: "Ordenar: código",
  freq: "Ordenar: frequência (30d)",
  atualizado: "Ordenar: última edição",
} as const;

const OPCOES_DE_PENALIZA = [
  { valor: "tudo", rotulo: "Todos" },
  { valor: "sim", rotulo: "Só penalizantes" },
  { valor: "nao", rotulo: "Só não-penalizantes" },
];

const OPCOES_DE_SITUACAO = [
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "inativo", rotulo: "Inativos" },
  { valor: "tudo", rotulo: "Todos" },
] as const;

const ROTULO_DO_LOTE: Record<AcaoEmLote, string> = {
  ativar: "Ativar",
  desativar: "Desativar",
  penaliza_true: "Marcar penaliza",
  penaliza_false: "Desmarcar penaliza",
};

function statusDaPrecisao(p: number): StatusKpi {
  return p > 0.95 ? "bom" : p > 0.8 ? "alerta" : "ruim";
}

/** Classificação rápida de um código pendente: letra + penaliza. */
function LinhaPendente({
  codigo,
  rotulos,
  podeEditar,
  aoClassificar,
}: {
  codigo: CodigoDoAdmin;
  rotulos: Record<LetraDeResponsavel, string>;
  podeEditar: boolean;
  aoClassificar: (letra: LetraDeResponsavel, penaliza: boolean) => void;
}) {
  const [letra, setLetra] = useState<LetraDeResponsavel>(
    ehLetra(codigo.letraResponsavel) ? codigo.letraResponsavel : "F",
  );
  const [penaliza, setPenaliza] = useState(codigo.penaliza);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[13px]">
      <span className="font-mono font-bold">#{codigo.codigo}</span>
      <span className="min-w-[160px] flex-1 truncate">{codigo.descricao}</span>
      <span className="text-[12.5px] text-muted-foreground tabular-nums">
        {formatarInteiro(codigo.frequencia30d)} em 30d
      </span>
      <Escolha
        rotulo={`Responsável do código ${String(codigo.codigo)}`}
        className="h-8 w-[220px]"
        opcoes={LETRAS_DE_RESPONSAVEL.map((l) => ({ valor: l, rotulo: `${l} — ${rotulos[l]}` }))}
        valor={letra}
        disabled={!podeEditar}
        aoMudar={(v) => {
          if (ehLetra(v)) setLetra(v);
        }}
      />
      <label className="flex items-center gap-2">
        <Checkbox
          checked={penaliza}
          disabled={!podeEditar}
          onCheckedChange={(v) => {
            setPenaliza(v === true);
          }}
        />
        Penaliza
      </label>
      <Button
        size="sm"
        disabled={!podeEditar}
        onClick={() => {
          aoClassificar(letra, penaliza);
        }}
      >
        <Sparkles aria-hidden /> Classificar
      </Button>
    </li>
  );
}

export function PaginaCodigos() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "FR";
  const fuso = useFusoDaEmpresa();
  const podeEditar = pode(acesso, "admin_codigos", "editar");
  const rotulos = rotulosDaLetra(nomeCurto);
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaCodigos);
  const codigos = consulta.data?.codigos ?? [];
  const estatisticas = consulta.data?.estatisticas;

  const [filtros, setFiltros] = useState<FiltrosDosCodigos>(FILTROS_INICIAIS);
  const [selecionados, setSelecionados] = useState<ReadonlySet<number>>(new Set());
  const [editando, setEditando] = useState<CodigoDoAdmin | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const visiveis = filtrarCodigos(codigos, filtros);
  const pendentes = codigos.filter((x) => x.pendenteClassificacao);
  const mudar = (m: Partial<FiltrosDosCodigos>) => {
    setFiltros((f) => ({ ...f, ...m }));
  };

  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE_DOS_CODIGOS });
  const salvar = async (s: CodigoParaSalvar, sucesso: (afetadas: number) => string) => {
    try {
      const r = await chamar(c.salvar, {
        parametros: { codigo: String(s.codigo) },
        entrada: {
          descricao: s.descricao,
          letra: s.letra,
          penaliza: s.penaliza,
          ativo: s.ativo,
          notas: s.notas,
        },
      });
      toast.success(sucesso(r.afetadas));
      await atualizar();
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  const classificar = (x: CodigoDoAdmin, letra: LetraDeResponsavel, penaliza: boolean) =>
    void salvar(
      { codigo: x.codigo, descricao: x.descricao, letra, penaliza, ativo: x.ativo, notas: x.notas },
      (n) =>
        `Código ${String(x.codigo)} classificado · ${formatarInteiro(n)} ocorrência(s) atualizadas`,
    );
  const aplicarLote = async (acao: AcaoEmLote) => {
    if (
      !window.confirm(
        `Aplicar "${ROTULO_DO_LOTE[acao]}" em ${String(selecionados.size)} código(s)?`,
      )
    ) {
      return;
    }
    try {
      const r = await chamar(c.lote, { entrada: { codigos: [...selecionados], acao } });
      toast.success(`${formatarInteiro(r.alterados)} código(s) atualizados`);
      setSelecionados(new Set());
      await atualizar();
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    }
  };
  const alternarSelecao = (codigo: number) => {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (!novo.delete(codigo)) novo.add(codigo);
      return novo;
    });
  };
  const abrir = (x: CodigoDoAdmin | null) => {
    setEditando(x);
    setModalAberto(true);
  };

  const colunas: ColunaTabela<CodigoDoAdmin>[] = [
    ...(podeEditar
      ? [
          {
            chave: "selecao",
            titulo: "",
            ordenavel: false,
            semExportar: true,
            fixa: true,
            celula: (x: CodigoDoAdmin) => (
              <Checkbox
                aria-label={`Selecionar código ${String(x.codigo)}`}
                checked={selecionados.has(x.codigo)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                onCheckedChange={() => {
                  alternarSelecao(x.codigo);
                }}
              />
            ),
          },
        ]
      : []),
    { chave: "codigo", titulo: "Cód.", classe: "font-mono", fixa: true },
    {
      chave: "letraResponsavel",
      titulo: "Letra",
      valor: (x) => x.letraResponsavel,
      celula: (x) =>
        x.letraResponsavel ? (
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-xs font-bold"
            title={ehLetra(x.letraResponsavel) ? rotulos[x.letraResponsavel] : undefined}
          >
            {x.letraResponsavel}
          </span>
        ) : null,
    },
    { chave: "descricao", titulo: "Descrição", classe: "max-w-[320px] truncate" },
    {
      chave: "responsavel",
      titulo: "Responsável",
      valor: (x) => (ehLetra(x.letraResponsavel) ? rotulos[x.letraResponsavel] : x.responsavel),
    },
    {
      chave: "penaliza",
      titulo: "Penaliza",
      valor: (x) => (x.penaliza ? "Sim" : "Não"),
      celula: (x) =>
        x.penaliza ? <span className="font-semibold text-status-bad-fg">Sim</span> : "Não",
    },
    { chave: "tipoSsw", titulo: "Tipo SSW" },
    { chave: "processoSsw", titulo: "Processo" },
    { chave: "frequencia30d", titulo: "Ocorr. 30d", formato: "inteiro" },
    {
      chave: "atualizadoEm",
      titulo: "Última edição",
      formato: "datahora",
      valor: (x) => x.atualizadoEm,
    },
    { chave: "atualizadoPorNome", titulo: "Editado por", oculta: true },
    {
      chave: "status",
      titulo: "Status",
      valor: (x) => (x.pendenteClassificacao ? "Pendente" : x.ativo ? "Ativo" : "Inativo"),
      celula: (x) =>
        x.pendenteClassificacao ? (
          <SeloStatus tom="alerta">pendente</SeloStatus>
        ) : x.ativo ? (
          <SeloStatus tom="sucesso">ativo</SeloStatus>
        ) : (
          <SeloStatus tom="neutro">inativo</SeloStatus>
        ),
    },
    { chave: "notas", titulo: "Notas", oculta: true },
  ];

  const precisao = estatisticas?.precisao ?? 1;
  const filtrosMexidos =
    filtros.busca !== FILTROS_INICIAIS.busca ||
    filtros.letras.length > 0 ||
    filtros.penaliza !== FILTROS_INICIAIS.penaliza ||
    filtros.ativo !== FILTROS_INICIAIS.ativo ||
    filtros.ordem !== FILTROS_INICIAIS.ordem;
  return (
    <Pagina
      titulo="Códigos de ocorrência"
      descricao="Configure quem penaliza cada código — espelho da tela 405 do SSW."
      acoes={
        podeEditar && (
          <Button
            size="sm"
            onClick={() => {
              abrir(null);
            }}
          >
            <Plus aria-hidden /> Novo código
          </Button>
        )
      }
      filtros={
        <FiltrosAvancados
          ativos={filtrosMexidos}
          aoLimpar={() => {
            setFiltros(FILTROS_INICIAIS);
          }}
        >
          <Alternador
            rotulo="Situação"
            opcoes={OPCOES_DE_SITUACAO}
            valor={filtros.ativo}
            aoMudar={(ativo) => {
              mudar({ ativo });
            }}
          />
          <FiltroMultiplo
            rotulo="Letra"
            opcoes={LETRAS_DE_RESPONSAVEL.map((l) => ({
              valor: l,
              rotulo: `${l} — ${rotulos[l]}`,
            }))}
            selecionados={filtros.letras}
            aoMudar={(v) => {
              mudar({ letras: v.filter(ehLetra) });
            }}
            resumo={(v) => v.join(" · ")}
            busca={false}
          />
          <Escolha
            filtro
            rotulo="Penaliza"
            prefixo="Penaliza"
            opcoes={OPCOES_DE_PENALIZA}
            valor={filtros.penaliza}
            aoMudar={(v) => {
              mudar({ penaliza: v === "sim" || v === "nao" ? v : "tudo" });
            }}
          />
          <Escolha
            filtro
            rotulo="Ordem"
            opcoes={ORDENS.map((o) => ({ valor: o, rotulo: ROTULO_DA_ORDEM[o] }))}
            valor={filtros.ordem}
            aoMudar={(v) => {
              mudar({ ordem: ORDENS.find((o) => o === v) ?? "codigo" });
            }}
          />
          <BuscaNaBarra
            rotulo="Buscar código"
            placeholder="código ou descrição"
            valor={filtros.busca}
            aoMudar={(busca) => {
              mudar({ busca });
            }}
          />
        </FiltrosAvancados>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Classificados"
          valor={`${formatarInteiro(estatisticas?.classificados ?? 0)} / ${formatarInteiro(estatisticas?.total ?? 0)}`}
          status="bom"
          icone={ListChecks}
          detalhe="Códigos com responsável e penaliza definidos"
        />
        <KpiCard
          rotulo="Pendentes de classificação"
          valor={formatarInteiro(estatisticas?.pendentes ?? 0)}
          status={(estatisticas?.pendentes ?? 0) > 0 ? "alerta" : "bom"}
          icone={Hourglass}
          detalhe="Códigos novos ou marcados para revisar"
        />
        <KpiCard
          rotulo="Ocorrências aguardando"
          valor={formatarInteiro(estatisticas?.ocorrenciasEmPendentes ?? 0)}
          status={(estatisticas?.ocorrenciasEmPendentes ?? 0) > 0 ? "alerta" : "bom"}
          icone={Inbox}
          detalhe="Ocorrências em códigos pendentes"
        />
        <KpiCard
          rotulo="Precisão do cálculo"
          valor={formatarPercentual(precisao)}
          status={statusDaPrecisao(precisao)}
          icone={Target}
          detalhe="Ocorrências de 30 dias em códigos já classificados"
          progresso={precisao}
        />
      </div>

      {pendentes.length > 0 && (
        <Painel
          titulo={
            <span className="flex items-center gap-2 text-status-warn-fg">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> Códigos pendentes —
              classifique para os números ficarem exatos
            </span>
          }
          className="border-status-warn/40 bg-status-warn-bg"
        >
          <ul className="divide-y divide-border">
            {pendentes.map((x) => (
              <LinhaPendente
                key={x.codigo}
                codigo={x}
                rotulos={rotulos}
                podeEditar={podeEditar}
                aoClassificar={(letra, penaliza) => {
                  classificar(x, letra, penaliza);
                }}
              />
            ))}
          </ul>
        </Painel>
      )}

      <TabelaDados
        colunas={colunas}
        linhas={visiveis}
        chaveDaLinha={(x) => String(x.codigo)}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum código com esses filtros."
        porPagina={0}
        aoClicarLinha={(x) => {
          abrir(x);
        }}
        acoes={
          podeEditar &&
          selecionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-foreground">
                {selecionados.size} selecionado(s):
              </span>
              {ACOES_EM_LOTE.map((acao) => (
                <Button
                  key={acao}
                  size="sm"
                  variant="outline"
                  onClick={() => void aplicarLote(acao)}
                >
                  {ROTULO_DO_LOTE[acao]}
                </Button>
              ))}
            </div>
          )
        }
        configurarColunas
        rotuloTotal={(n) => `${formatarInteiro(n)} código(s)`}
        exportacao={{ arquivo: "codigos-ocorrencia", titulo: "Códigos de ocorrência" }}
      />

      <ModalDoCodigo
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        editando={editando}
        nomeCurto={nomeCurto}
        fuso={fuso}
        aoSalvar={(s) =>
          salvar(
            s,
            (n) => `Salvo · ${formatarInteiro(n)} ocorrência(s) atualizadas retroativamente`,
          )
        }
      />
    </Pagina>
  );
}
