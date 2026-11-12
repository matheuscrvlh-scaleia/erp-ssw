import { type Feriado, UFS } from "@erp/shared/contratos/calendario";
import { contratosHistorico as c, type FeriadoDoHistorico } from "@erp/shared/contratos/historico";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Aviso } from "@/componentes/comum/Aviso";
import { EtiquetaDoTipo } from "@/componentes/comum/EtiquetaDoTipo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { FiltroUnico } from "@/componentes/comum/FiltroUnico";
import { type FeriadoParaGravar, ModalDeFeriado } from "@/componentes/comum/ModalDeFeriado";
import { SeletorDeAno } from "@/componentes/comum/SeletorDeAno";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { CHAVE_DO_CALENDARIO } from "@/modulos/calendario/api";

import { CHAVE_DO_HISTORICO, consultaFeriados } from "./api";

type Tipo = "" | "nacional" | "municipal";

/**
 * Administração › Configurações › Feriados (admin da empresa). Mesmas regras do Calendário;
 * feriado geral (sem empresa) vale para todas e só a Plataforma altera, em Plataforma ›
 * Configurações (Q28): aqui aparece sem os botões.
 */
export function PaginaFeriados() {
  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const queryClient = useQueryClient();
  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
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
      celula: (f) => <EtiquetaDoTipo tipo={f.tipo} />,
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
          <span className="text-xs text-muted-foreground" title="Cadastrado pela Plataforma">
            todas as empresas
          </span>
        ) : (
          <span className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 px-0 text-muted-foreground"
              aria-label={`Editar ${f.descricao}`}
              title={`Editar ${f.descricao}`}
              onClick={() => {
                abrir(f);
              }}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
              aria-label={`Excluir ${f.descricao}`}
              title={`Excluir ${f.descricao}`}
              onClick={() => {
                excluir(f);
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </span>
        ),
    },
  ];

  return (
    <Pagina
      titulo="Feriados"
      descricao="Os feriados da empresa. Os gerais valem para todas as empresas e são mantidos pela Plataforma."
      acoes={
        <>
          <Button variant="outline" size="sm" onClick={() => void importarNacionais()}>
            <Download aria-hidden /> Importar nacionais {ano}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              abrir(null);
            }}
          >
            <Plus aria-hidden /> Novo feriado
          </Button>
        </>
      }
      filtros={
        <FiltrosAvancados
          ativos={tipo !== "" || uf !== ""}
          aoLimpar={() => {
            setTipo("");
            setUf("");
          }}
        >
          <SeletorDeAno ano={ano} anoAtual={anoAtual} aoMudar={setAno} />
          <FiltroUnico
            rotulo="Tipo"
            valor={tipo}
            todos="Todos os tipos"
            opcoes={[
              { valor: "nacional", rotulo: "Nacional" },
              { valor: "municipal", rotulo: "Municipal" },
            ]}
            aoMudar={(v) => {
              setTipo(v === "nacional" || v === "municipal" ? v : "");
            }}
          />
          <FiltroUnico
            rotulo="UF"
            valor={uf}
            todos="Todos UFs"
            opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
            aoMudar={setUf}
          />
        </FiltrosAvancados>
      }
    >
      {consulta.data?.truncado && (
        <Aviso tom="info">
          A lista foi cortada no limite da tela. Filtre por ano para ver todos.
        </Aviso>
      )}

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

      <ModalDeFeriado
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        editando={editando}
        hoje={hoje}
        aoGravar={gravar}
        semRecorrencia
      />
    </Pagina>
  );
}
