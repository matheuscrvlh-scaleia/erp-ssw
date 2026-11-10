import { ehAdminDaEmpresa } from "@erp/shared/acesso/papeis";
import {
  type AcaoEmLote,
  type CodigoDoAdmin,
  contratosCodigosOcorrencia as c,
  type LetraDeResponsavel,
  LETRAS_DE_RESPONSAVEL,
} from "@erp/shared/contratos/codigos-ocorrencia";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { KpiCard, type StatusKpi } from "@/componentes/comum/KpiCard";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { classeDoSegmento } from "@/modulos/compartilhado/segmento";

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
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-card px-3 py-2 text-[12px]">
      <span className="font-mono font-bold">#{codigo.codigo}</span>
      <span className="min-w-[160px] flex-1 truncate">{codigo.descricao}</span>
      <span className="text-muted-foreground tabular-nums">
        {formatarInteiro(codigo.frequencia30d)} em 30d
      </span>
      <select
        aria-label={`Responsável do código ${String(codigo.codigo)}`}
        value={letra}
        disabled={!podeEditar}
        onChange={(e) => {
          if (ehLetra(e.target.value)) setLetra(e.target.value);
        }}
        className="rounded border border-border bg-background px-1 py-0.5"
      >
        {LETRAS_DE_RESPONSAVEL.map((l) => (
          <option key={l} value={l}>
            {l} — {rotulos[l]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={penaliza}
          disabled={!podeEditar}
          onChange={(e) => {
            setPenaliza(e.target.checked);
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
        <Sparkles className="mr-1 h-3 w-3" /> Classificar
      </Button>
    </li>
  );
}

export function PaginaCodigos() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "FR";
  const fuso = useFusoDaEmpresa();
  const podeEditar = ehAdminDaEmpresa(acesso.papel);
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
              <input
                type="checkbox"
                aria-label={`Selecionar código ${String(x.codigo)}`}
                checked={selecionados.has(x.codigo)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onChange={() => {
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
            className="rounded bg-muted px-1.5 font-mono font-bold"
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
        x.penaliza ? <span className="font-semibold text-[var(--status-bad)]">Sim</span> : "Não",
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
          <span className="text-[11px] font-semibold text-amber-700">pendente</span>
        ) : x.ativo ? (
          <span className="text-[11px] text-emerald-700">ativo</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">inativo</span>
        ),
    },
    { chave: "notas", titulo: "Notas", oculta: true },
  ];

  const precisao = estatisticas?.precisao ?? 1;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold">
            <Settings2 className="h-5 w-5 text-primary" /> Códigos de ocorrência
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Configure quem penaliza cada código — espelho da tela 405 do SSW.
          </p>
        </div>
        {podeEditar && (
          <Button
            size="sm"
            onClick={() => {
              abrir(null);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo código
          </Button>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Classificados"
          valor={`${formatarInteiro(estatisticas?.classificados ?? 0)} / ${formatarInteiro(estatisticas?.total ?? 0)}`}
          status="bom"
          detalhe="Códigos com responsável e penaliza definidos"
        />
        <KpiCard
          rotulo="Pendentes de classificação"
          valor={formatarInteiro(estatisticas?.pendentes ?? 0)}
          status={(estatisticas?.pendentes ?? 0) > 0 ? "alerta" : "bom"}
          detalhe="Códigos novos ou marcados para revisar"
        />
        <KpiCard
          rotulo="Ocorrências aguardando"
          valor={formatarInteiro(estatisticas?.ocorrenciasEmPendentes ?? 0)}
          status={(estatisticas?.ocorrenciasEmPendentes ?? 0) > 0 ? "alerta" : "bom"}
          detalhe="Ocorrências em códigos pendentes"
        />
        <KpiCard
          rotulo="Precisão do cálculo"
          valor={formatarPercentual(precisao)}
          status={statusDaPrecisao(precisao)}
          detalhe="Ocorrências de 30 dias em códigos já classificados"
          progresso={precisao}
        />
      </div>

      {consulta.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {mensagemAmigavel(consulta.error)}
        </p>
      )}

      {pendentes.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Códigos pendentes — classifique para os números
            ficarem exatos
          </h2>
          <ul className="space-y-1.5">
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
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-card/40 p-3 text-[12px]">
        <input
          aria-label="Buscar código"
          placeholder="código ou descrição"
          value={filtros.busca}
          onChange={(e) => {
            mudar({ busca: e.target.value });
          }}
          className="h-7 w-48 rounded border border-border bg-background px-2"
        />
        <div
          role="group"
          aria-label="Letra"
          className="flex rounded-md border border-border/70 p-0.5"
        >
          {LETRAS_DE_RESPONSAVEL.map((l) => {
            const ativa = filtros.letras.includes(l);
            return (
              <button
                key={l}
                type="button"
                title={rotulos[l]}
                aria-pressed={ativa}
                onClick={() => {
                  mudar({
                    letras: ativa ? filtros.letras.filter((x) => x !== l) : [...filtros.letras, l],
                  });
                }}
                className={`${classeDoSegmento(ativa)} font-mono`}
              >
                {l}
              </button>
            );
          })}
        </div>
        <select
          aria-label="Penaliza"
          value={filtros.penaliza}
          onChange={(e) => {
            const v = e.target.value;
            mudar({ penaliza: v === "sim" || v === "nao" ? v : "tudo" });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="tudo">Todos</option>
          <option value="sim">Só penalizantes</option>
          <option value="nao">Só não-penalizantes</option>
        </select>
        <select
          aria-label="Situação"
          value={filtros.ativo}
          onChange={(e) => {
            const v = e.target.value;
            mudar({ ativo: v === "ativo" || v === "inativo" ? v : "tudo" });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="tudo">Todos</option>
        </select>
        <select
          aria-label="Ordem"
          value={filtros.ordem}
          onChange={(e) => {
            mudar({ ordem: ORDENS.find((o) => o === e.target.value) ?? "codigo" });
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          {ORDENS.map((o) => (
            <option key={o} value={o}>
              {ROTULO_DA_ORDEM[o]}
            </option>
          ))}
        </select>
        {podeEditar && selecionados.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground">{selecionados.size} selecionado(s):</span>
            {(Object.keys(ROTULO_DO_LOTE) as AcaoEmLote[]).map((acao) => (
              <Button key={acao} size="sm" variant="outline" onClick={() => void aplicarLote(acao)}>
                {ROTULO_DO_LOTE[acao]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <TabelaDados
        colunas={colunas}
        linhas={visiveis}
        chaveDaLinha={(x) => String(x.codigo)}
        carregando={consulta.isLoading}
        mensagemVazia="Nenhum código com esses filtros."
        porPagina={0}
        aoClicarLinha={(x) => {
          abrir(x);
        }}
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
    </div>
  );
}
