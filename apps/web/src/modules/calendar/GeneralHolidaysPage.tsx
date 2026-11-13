import { type Feriado } from "@erp/shared/contracts/calendar";
import { hojeNoFuso } from "@erp/shared/dates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { type FeriadoParaGravar, ModalDeFeriado } from "@/components/common/HolidayModal";
import { EtiquetaDoTipo } from "@/components/common/TypeTag";
import { SeletorDeAno } from "@/components/common/YearSelector";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { useGravacao } from "@/hooks/use-save";

import {
  consultaFeriadosGerais,
  mutacaoAlterarFeriadoGeral,
  mutacaoCriarFeriadoGeral,
  mutacaoExcluirFeriadoGeral,
  mutacaoGerarNacionais,
} from "./api";

/**
 * Plataforma › Configurações › Feriados gerais: os feriados sem empresa, que valem para todas.
 * Só a Plataforma cria, altera e exclui; as empresas os veem (só leitura) no Calendário e em
 * Administração › Configurações › Feriados.
 */
export function PaginaFeriadosGerais() {
  const fuso = useFusoDaEmpresa();
  const hoje = hojeNoFuso(fuso);
  const anoAtual = Number(hoje.slice(0, 4));
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(anoAtual);
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const consulta = useQuery(consultaFeriadosGerais(ano));

  const gerar = useGravacao({
    mutacao: mutacaoGerarNacionais(queryClient),
    sucesso: (_, r) =>
      `${String(r.inseridos)} feriado(s) gerado(s) · ${String(r.existiam)} já existiam`,
  });
  const apagar = useGravacao({
    mutacao: mutacaoExcluirFeriadoGeral(queryClient),
    sucesso: "Feriado excluído",
  });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarFeriadoGeral(queryClient),
    sucesso: "Feriado atualizado",
  });
  const criar = useGravacao({
    mutacao: mutacaoCriarFeriadoGeral(queryClient),
    sucesso: (_, r) => `${String(r.inseridos)} feriado(s) inserido(s)`,
  });
  const gerarNacionais = () => {
    const confirmou = window.confirm(
      `Vamos gerar os feriados nacionais de ${String(ano)} e dos próximos 4 anos para todas as empresas. Feriados já cadastrados serão mantidos. Continuar?`,
    );
    if (!confirmou) return;
    void gerar.gravar({ ano, anosAFrente: 4 });
  };
  const excluir = (f: Feriado) => {
    if (!window.confirm(`Excluir "${f.descricao}" de todas as empresas?`)) return;
    void apagar.gravar(f.id);
  };
  const gravar = ({ dados, recorrente }: FeriadoParaGravar) =>
    editando
      ? alterar.gravar({ id: editando.id, dados })
      : criar.gravar({ ...dados, recorrente, anosAFrente: 5 });
  const abrir = (f: Feriado | null) => {
    setEditando(f);
    setModalAberto(true);
  };

  const colunas: ColunaTabela<Feriado>[] = [
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
      celula: (f) => (
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
      titulo="Feriados gerais"
      descricao="Valem para todas as empresas. Cada empresa cadastra os seus em Administração › Configurações › Feriados."
      acoes={
        <>
          <Button variant="outline" size="sm" onClick={gerarNacionais}>
            <Sparkles aria-hidden /> Gerar nacionais
          </Button>
          <Button
            size="sm"
            onClick={() => {
              abrir(null);
            }}
          >
            <Plus aria-hidden /> Novo feriado geral
          </Button>
        </>
      }
      filtros={
        <FiltrosAvancados>
          <SeletorDeAno ano={ano} anoAtual={anoAtual} aoMudar={setAno} />
        </FiltrosAvancados>
      }
    >
      <TabelaDados
        colunas={colunas}
        linhas={consulta.data?.feriados ?? []}
        chaveDaLinha={(f) => f.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => {
          void consulta.refetch();
        }}
        mensagemVazia={`Nenhum feriado geral em ${String(ano)}. Use "Gerar nacionais" ou cadastre um.`}
        porPagina={0}
        rotuloTotal={(n) => `${String(n)} feriado(s)`}
        exportacao={{
          arquivo: `feriados-gerais-${String(ano)}`,
          titulo: "Feriados gerais",
          subtitulo: String(ano),
        }}
      />

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
