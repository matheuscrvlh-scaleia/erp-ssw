import {
  type AcaoEmLote,
  type CodigoDoAdmin,
  type LetraDeResponsavel,
} from "@erp/shared/contracts/occurrence-codes";
import { formatarInteiro } from "@erp/shared/formatting";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { pode } from "@/access/permission";
import { consultaAcesso } from "@/access/session";
import { Pagina } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useFusoDaEmpresa } from "@/hooks/use-company-timezone";
import { mensagemAmigavel } from "@/lib/error-message";

import { consultaCodigos, mutacaoAplicarLote, mutacaoSalvarCodigo } from "./api";
import { type CodigoParaSalvar, ModalDoCodigo } from "./components/CodeModal";
import { FiltrosCodigos } from "./components/CodesFilters";
import { KpisDosCodigos } from "./components/CodesKpis";
import { TabelaCodigos } from "./components/CodesTable";
import { PainelDePendentes } from "./components/PendingPanel";
import { filtrarCodigos, FILTROS_INICIAIS, type FiltrosDosCodigos, rotulosDaLetra } from "./rules";
import { ROTULO_DO_LOTE } from "./texts";

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

  // O aviso de sucesso sai quando a api responde, antes de a lista recarregar.
  const classificacao = useMutation(
    mutacaoSalvarCodigo(queryClient, (r, s) => {
      toast.success(
        `Código ${String(s.codigo)} classificado · ${formatarInteiro(r.afetadas)} ocorrência(s) atualizadas`,
      );
    }),
  );
  const edicao = useMutation(
    mutacaoSalvarCodigo(queryClient, (r) => {
      toast.success(
        `Salvo · ${formatarInteiro(r.afetadas)} ocorrência(s) atualizadas retroativamente`,
      );
    }),
  );
  const lote = useMutation(
    mutacaoAplicarLote(queryClient, (r) => {
      toast.success(`${formatarInteiro(r.alterados)} código(s) atualizados`);
      setSelecionados(new Set());
    }),
  );

  const salvar = async (s: CodigoParaSalvar, mutacao: typeof edicao) => {
    try {
      await mutacao.mutateAsync(s);
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  const classificar = (x: CodigoDoAdmin, letra: LetraDeResponsavel, penaliza: boolean) =>
    void salvar(
      { codigo: x.codigo, descricao: x.descricao, letra, penaliza, ativo: x.ativo, notas: x.notas },
      classificacao,
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
      await lote.mutateAsync({ codigos: [...selecionados], acao });
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

  return (
    <Pagina
      titulo="Códigos de ocorrências"
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
        <FiltrosCodigos
          filtros={filtros}
          rotulos={rotulos}
          aoMudar={mudar}
          aoLimpar={() => {
            setFiltros(FILTROS_INICIAIS);
          }}
        />
      }
    >
      <KpisDosCodigos estatisticas={estatisticas} />

      {pendentes.length > 0 && (
        <PainelDePendentes
          pendentes={pendentes}
          rotulos={rotulos}
          podeEditar={podeEditar}
          aoClassificar={classificar}
        />
      )}

      <TabelaCodigos
        codigos={visiveis}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        rotulos={rotulos}
        podeEditar={podeEditar}
        selecionados={selecionados}
        aoAlternarSelecao={alternarSelecao}
        aoAplicarLote={(acao) => void aplicarLote(acao)}
        aoAbrir={(x) => {
          abrir(x);
        }}
      />

      <ModalDoCodigo
        aberto={modalAberto}
        aoMudarAberto={setModalAberto}
        editando={editando}
        nomeCurto={nomeCurto}
        fuso={fuso}
        aoSalvar={(s) => salvar(s, edicao)}
      />
    </Pagina>
  );
}
