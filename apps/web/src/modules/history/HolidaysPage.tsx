import { type Feriado, UFS } from "@erp/shared/contracts/calendar";
import { type FeriadoDoHistorico } from "@erp/shared/contracts/history";
import { hojeNoFuso } from "@erp/shared/dates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { type FeriadoParaGravar, ModalDeFeriado } from "@/components/common/HolidayModal";
import { Aviso } from "@/components/common/Notice";
import { FiltroUnico } from "@/components/common/SingleFilter";
import { EtiquetaDoTipo } from "@/components/common/TypeTag";
import { SeletorDeAno } from "@/components/common/YearSelector";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useGravacao } from "@/hooks/use-save";

import {
  consultaFeriados,
  mutacaoAlterarFeriado,
  mutacaoCriarFeriado,
  mutacaoExcluirFeriado,
  mutacaoImportarNacionais,
} from "./api";

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

  const importar = useGravacao({
    mutacao: mutacaoImportarNacionais(queryClient),
    sucesso: (_ano, r) => `${String(r.inseridos)} feriado(s) nacional(is) inseridos`,
  });
  const apagar = useGravacao({
    mutacao: mutacaoExcluirFeriado(queryClient),
    sucesso: "Feriado excluído",
  });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarFeriado(queryClient),
    sucesso: "Feriado atualizado",
  });
  const criar = useGravacao({
    mutacao: mutacaoCriarFeriado(queryClient),
    sucesso: "Feriado cadastrado",
  });
  const importarNacionais = () => importar.gravar(ano);
  const excluir = (f: FeriadoDoHistorico) => {
    if (!window.confirm(`Excluir "${f.descricao}"?`)) return;
    void apagar.gravar(f.id);
  };
  const gravar = ({ dados }: FeriadoParaGravar) =>
    editando ? alterar.gravar({ id: editando.id, dados }) : criar.gravar(dados);
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
