import { type Feriado, UFS } from "@erp/shared/contratos/calendario";
import { contratosHistorico as c, type FeriadoDoHistorico } from "@erp/shared/contratos/historico";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { CHAVE_DO_CALENDARIO } from "@/modulos/calendario/api";
import { type FeriadoParaGravar, ModalDeFeriado } from "@/modulos/calendario/ModalDeFeriado";

import { CHAVE_DO_HISTORICO, consultaFeriados } from "./api";

type Tipo = "" | "nacional" | "municipal";

/**
 * Histórico › Feriados (admin da empresa). Mesmas regras do Calendário; feriado nacional sem
 * empresa vale para todas e só a Plataforma altera (Q28): aqui aparece sem os botões.
 */
export function PaginaFeriados() {
  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [tipo, setTipo] = useState<Tipo>("");
  const [uf, setUf] = useState("");
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const consulta = useQuery(consultaFeriados(ano));
  const feriados = (consulta.data?.feriados ?? []).filter(
    (f) => (tipo === "" || f.tipo === tipo) && (uf === "" || f.uf === uf),
  );

  const atualizar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CHAVE_DO_HISTORICO }),
      queryClient.invalidateQueries({ queryKey: CHAVE_DO_CALENDARIO }),
    ]);
  const executar = async (acao: () => Promise<string>) => {
    try {
      toast.success(await acao());
      await atualizar();
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  const importarNacionais = () =>
    executar(async () => {
      const r = await chamar(c.importarNacionais, { entrada: { ano } });
      return `${String(r.inseridos)} feriado(s) nacional(is) inseridos`;
    });
  const excluir = (f: FeriadoDoHistorico) => {
    if (!window.confirm(`Excluir "${f.descricao}"?`)) return;
    void executar(async () => {
      await chamar(c.excluirFeriado, { parametros: { id: f.id } });
      return "Feriado excluído";
    });
  };
  const gravar = ({ dados }: FeriadoParaGravar) =>
    executar(async () => {
      if (editando) {
        await chamar(c.alterarFeriado, { parametros: { id: editando.id }, entrada: dados });
        return "Feriado atualizado";
      }
      await chamar(c.criarFeriado, { entrada: dados });
      return "Feriado cadastrado";
    });
  const abrir = (f: Feriado | null) => {
    setEditando(f);
    setModalAberto(true);
  };

  const colunas: ColunaTabela<FeriadoDoHistorico>[] = [
    { chave: "data", titulo: "Data", formato: "data" },
    {
      chave: "tipo",
      titulo: "Tipo",
      valor: (f) =>
        f.tipo === "nacional" ? "Nacional" : f.tipo === "estadual" ? "Estadual" : "Municipal",
    },
    { chave: "cidade", titulo: "Cidade" },
    { chave: "uf", titulo: "UF" },
    { chave: "descricao", titulo: "Descrição" },
    {
      chave: "acoes",
      titulo: "",
      ordenavel: false,
      semExportar: true,
      fixa: true,
      celula: (f) =>
        f.global ? (
          <span className="text-[11px] text-muted-foreground" title="Cadastrado pela Plataforma">
            todas as empresas
          </span>
        ) : (
          <span className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Editar ${f.descricao}`}
              onClick={() => {
                abrir(f);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Excluir ${f.descricao}`}
              onClick={() => {
                excluir(f);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" /> Feriados
          </h1>
          <Link
            to="/historico"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao histórico
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void importarNacionais()}>
            <Download className="mr-1 h-4 w-4" /> Importar nacionais {ano}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              abrir(null);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo feriado
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-card/40 p-3 text-[12px]">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">Ano</span>
          <input
            type="number"
            value={ano}
            onChange={(e) => {
              setAno(Number(e.target.value) || Number(hoje.slice(0, 4)));
            }}
            className="w-20 rounded border border-border bg-background px-2 py-1 tabular-nums"
          />
        </label>
        <select
          aria-label="Tipo"
          value={tipo}
          onChange={(e) => {
            const v = e.target.value;
            setTipo(v === "nacional" || v === "municipal" ? v : "");
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Todos os tipos</option>
          <option value="nacional">Nacional</option>
          <option value="municipal">Municipal</option>
        </select>
        <select
          aria-label="UF"
          value={uf}
          onChange={(e) => {
            setUf(e.target.value);
          }}
          className="rounded border border-border bg-background px-2 py-1"
        >
          <option value="">Todos UFs</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <TabelaDados
        colunas={colunas}
        linhas={feriados}
        chaveDaLinha={(f) => f.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => {
          void consulta.refetch();
        }}
        mensagemVazia="Nenhum feriado encontrado."
        porPagina={0}
        rotuloTotal={(n) => `${String(n)} feriado(s)`}
        exportacao={{
          arquivo: `feriados-${String(ano)}`,
          titulo: "Feriados",
          subtitulo: String(ano),
        }}
      />
      {consulta.data?.truncado && (
        <p className="text-[12px] text-muted-foreground">
          A lista foi cortada no limite da tela. Filtre por ano para ver todos.
        </p>
      )}

      <ModalDeFeriado
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        editando={editando}
        hoje={hoje}
        aoGravar={gravar}
        semRecorrencia
      />
    </div>
  );
}
