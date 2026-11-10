import { ehAdminDaEmpresa } from "@erp/shared/acesso/papeis";
import { contratosCalendario as c, type Feriado } from "@erp/shared/contratos/calendario";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DO_CALENDARIO, consultaCalendario } from "./api";
import { formatarDiaCurto, porData } from "./calendario";
import { type FeriadoParaGravar, ModalDeFeriado } from "./ModalDeFeriado";
import { VisaoAno, VisaoLista, VisaoMes } from "./Visoes";

type Visao = "mes" | "ano" | "lista";

const ROTULO_DA_VISAO: Record<Visao, string> = {
  mes: "Mês a mês",
  ano: "Ano inteiro",
  lista: "Lista",
};

/** Tela molde: consulta por contrato, permissões vindas do acesso, escrita com aviso e invalidação. */
export function PaginaCalendario() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  // Escrita: admin da empresa (a Plataforma conta como admin). Nacionais: só a Plataforma (Q28).
  const podeEditar = ehAdminDaEmpresa(acesso.papel);
  const podeGerarNacionais = acesso.adminPlataforma;
  const queryClient = useQueryClient();

  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [visao, setVisao] = useState<Visao>("mes");
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const { data, isLoading } = useQuery(consultaCalendario(ano));
  const feriados = data?.feriados ?? [];
  const unidades = data?.unidades ?? [];
  const feriadosPorData = useMemo(() => porData(data?.feriados ?? []), [data]);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE_DO_CALENDARIO });

  const gerarNacionais = async () => {
    const confirmou = window.confirm(
      `Vamos gerar os feriados nacionais de ${ano} e dos próximos 4 anos. Feriados já cadastrados serão mantidos. Continuar?`,
    );
    if (!confirmou) return;
    try {
      const r = await chamar(c.gerarNacionais, { entrada: { ano, anosAFrente: 4 } });
      toast.success(`${r.inseridos} feriado(s) gerado(s) · ${r.existiam} já existiam`);
      await atualizar();
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    }
  };

  const excluir = async (f: Feriado) => {
    if (!window.confirm(`Excluir "${f.descricao}" em ${f.data}?`)) return;
    try {
      await chamar(c.excluirFeriado, { parametros: { id: f.id } });
      toast.success("Feriado excluído");
      await atualizar();
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    }
  };

  const gravar = async ({ dados, recorrente }: FeriadoParaGravar): Promise<boolean> => {
    try {
      if (editando) {
        await chamar(c.alterarFeriado, { parametros: { id: editando.id }, entrada: dados });
        toast.success("Feriado atualizado");
      } else {
        const r = await chamar(c.criarFeriado, {
          entrada: { ...dados, recorrente, anosAFrente: 5 },
        });
        toast.success(`${r.inseridos} feriado(s) inserido(s)`);
      }
      await atualizar();
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };

  const abrirModal = (feriado: Feriado | null) => {
    setEditando(feriado);
    setModalAberto(true);
  };

  const contagens = data?.contagens ?? { nacional: 0, municipal: 0, estadual: 0 };
  const proximo = data?.proximo ?? null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" /> Calendário de feriados
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Feriados nacionais e municipais que impactam o prazo de entrega.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex items-center gap-1 rounded border border-border/60 bg-card/40 p-1">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => {
                setAno(ano - 1);
              }}
              className="rounded p-1 hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="number"
              aria-label="Ano"
              value={ano}
              onChange={(e) => {
                setAno(Number(e.target.value) || Number(hoje.slice(0, 4)));
              }}
              className="w-20 bg-transparent text-center text-[13px] tabular-nums"
            />
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => {
                setAno(ano + 1);
              }}
              className="rounded p-1 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {podeGerarNacionais && (
            <Button variant="outline" size="sm" onClick={() => void gerarNacionais()}>
              <Sparkles className="mr-1 h-4 w-4" /> Gerar nacionais {ano}+
            </Button>
          )}
          {podeEditar && (
            <Button
              size="sm"
              onClick={() => {
                abrirModal(null);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Novo feriado
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Indicador
          rotulo={`Feriados nacionais em ${ano}`}
          valor={contagens.nacional}
          dica="Inclui pontos facultativos (Carnaval, Corpus Christi)"
        />
        <Indicador
          rotulo={`Feriados municipais em ${ano}`}
          valor={contagens.municipal}
          dica={`${contagens.estadual} estaduais cadastrados`}
        />
        <Indicador
          rotulo="Próximo feriado"
          valor={proximo ? `${diferencaEmDias(hoje, proximo.data)}d` : "—"}
          dica={
            proximo
              ? `${formatarDiaCurto(proximo.data)} · ${proximo.descricao}`
              : "Nenhum feriado futuro cadastrado"
          }
        />
      </div>

      <div className="flex items-center gap-1 rounded border border-border/60 bg-card/40 p-1 text-[12px]">
        {(["mes", "ano", "lista"] as const).map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              setVisao(v);
            }}
            aria-pressed={visao === v}
            className={`rounded px-3 py-1 ${visao === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {ROTULO_DA_VISAO[v]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded border border-border/60 bg-card/40 p-10 text-center text-[12px] text-muted-foreground">
          Carregando…
        </div>
      ) : feriados.length === 0 ? (
        <div className="rounded border border-border/60 bg-card/40 p-10 text-center text-[13px]">
          <p className="text-muted-foreground">Nenhum feriado cadastrado para {ano}.</p>
          {podeGerarNacionais && (
            <Button size="sm" className="mt-3" onClick={() => void gerarNacionais()}>
              <Sparkles className="mr-1 h-4 w-4" /> Gerar feriados nacionais
            </Button>
          )}
        </div>
      ) : visao === "mes" ? (
        <VisaoMes
          ano={ano}
          mes={mes}
          hoje={hoje}
          aoMudarMes={setMes}
          feriadosPorData={feriadosPorData}
          unidades={unidades}
        />
      ) : visao === "ano" ? (
        <VisaoAno
          ano={ano}
          feriadosPorData={feriadosPorData}
          aoEscolherMes={(m) => {
            setMes(m);
            setVisao("mes");
          }}
        />
      ) : (
        <VisaoLista
          feriados={feriados}
          unidades={unidades}
          hoje={hoje}
          podeEditar={podeEditar}
          aoEditar={abrirModal}
          aoExcluir={(f) => void excluir(f)}
        />
      )}

      <ModalDeFeriado
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        editando={editando}
        hoje={hoje}
        aoGravar={gravar}
      />
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  dica,
}: {
  rotulo: string;
  valor: number | string;
  dica: string;
}) {
  return (
    <div className="rounded-lg border border-l-[5px] border-border/60 border-l-kpi-positive bg-card p-4">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold text-kpi-positive tabular-nums">{valor}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{dica}</p>
    </div>
  );
}
