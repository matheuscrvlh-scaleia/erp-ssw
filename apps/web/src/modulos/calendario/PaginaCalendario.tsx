import { contratosCalendario as c, type Feriado } from "@erp/shared/contratos/calendario";
import { diferencaEmDias, hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, Flag, MapPin, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DO_CALENDARIO, consultaCalendario } from "./api";
import { formatarDiaCurto, porData } from "./calendario";
import { type FeriadoParaGravar, ModalDeFeriado } from "./ModalDeFeriado";
import { SeletorDeAno } from "./SeletorDeAno";
import { VisaoAno, VisaoLista, VisaoMes } from "./Visoes";

const VISOES = ["mes", "ano", "lista"] as const;
type Visao = (typeof VISOES)[number];

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
  // Escrita pela permissão do cargo (Criar/Editar, Excluir). Nacionais: só a Plataforma (Q28).
  const podeEditar = pode(acesso, "calendario", "editar");
  const podeExcluir = pode(acesso, "calendario", "excluir");
  const podeGerarNacionais = acesso.adminPlataforma;
  const queryClient = useQueryClient();

  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [visao, setVisao] = useState<Visao>("mes");
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const { data, isLoading, error, refetch } = useQuery(consultaCalendario(ano));
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
  const botaoGerar = (texto: string, variante: "outline" | "default") => (
    <Button variant={variante} size="sm" onClick={() => void gerarNacionais()}>
      <Sparkles aria-hidden /> {texto}
    </Button>
  );

  return (
    <Pagina
      titulo="Calendário de feriados"
      descricao="Feriados nacionais e municipais que impactam o prazo de entrega."
      acoes={
        <>
          {podeGerarNacionais && botaoGerar(`Gerar nacionais ${String(ano)}+`, "outline")}
          {podeEditar && (
            <Button
              size="sm"
              onClick={() => {
                abrirModal(null);
              }}
            >
              <Plus aria-hidden /> Novo feriado
            </Button>
          )}
        </>
      }
      abas={
        <Abas
          abas={VISOES.map((v) => ({ valor: v, rotulo: ROTULO_DA_VISAO[v] }))}
          valor={visao}
          aoMudar={setVisao}
          rotulo="Visão do calendário"
        />
      }
      filtros={
        <FiltrosAvancados>
          <SeletorDeAno ano={ano} anoAtual={anoAtual} aoMudar={setAno} />
        </FiltrosAvancados>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          rotulo={`Feriados nacionais em ${String(ano)}`}
          valor={String(contagens.nacional)}
          status="bom"
          neutro
          icone={Flag}
          detalhe="Inclui pontos facultativos (Carnaval, Corpus Christi)"
        />
        <KpiCard
          rotulo={`Feriados municipais em ${String(ano)}`}
          valor={String(contagens.municipal)}
          status="bom"
          neutro
          icone={MapPin}
          detalhe={`${String(contagens.estadual)} estaduais cadastrados`}
        />
        <KpiCard
          rotulo="Próximo feriado"
          valor={proximo ? `${String(diferencaEmDias(hoje, proximo.data))}d` : "—"}
          status="bom"
          neutro
          icone={CalendarClock}
          detalhe={
            proximo
              ? `${formatarDiaCurto(proximo.data)} · ${proximo.descricao}`
              : "Nenhum feriado futuro cadastrado"
          }
        />
      </div>

      {isLoading ? (
        <Painel classeDoCorpo="space-y-2 p-4">
          <Skeleton className="h-6 w-40 rounded-md bg-muted" />
          <Skeleton className="h-72 w-full rounded-lg bg-muted" />
        </Painel>
      ) : error ? (
        <Painel>
          <MensagemErro
            erro={error}
            aoTentarDeNovo={() => {
              void refetch();
            }}
          />
        </Painel>
      ) : feriados.length === 0 ? (
        <Painel>
          <EstadoVazio
            icone={CalendarDays}
            mensagem={`Nenhum feriado cadastrado para ${String(ano)}.`}
            acao={podeGerarNacionais && botaoGerar("Gerar feriados nacionais", "default")}
          />
        </Painel>
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
          hoje={hoje}
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
          podeExcluir={podeExcluir}
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
    </Pagina>
  );
}
