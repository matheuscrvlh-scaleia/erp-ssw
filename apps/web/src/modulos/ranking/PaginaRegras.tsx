import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosRanking as c } from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { useGravacao } from "@/hooks/use-gravacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { mesAnterior } from "@/lib/periodo-do-mes";

import { consultaRegras, mutacaoExcluirRegra, mutacaoSalvarRegra, simularRegra } from "./api";
import { CartaoDaRegra } from "./componentes/CartaoDaRegra";
import { ModalDaRegra } from "./componentes/ModalDaRegra";
import { type Rascunho, rascunhoDaRegra, rascunhoVazio } from "./regras";

type Simulacao = SaidaDe<typeof c.simularRegra>;

/** origem: routes/_authenticated/ranking.regras.tsx (sistema atual) */
export function PaginaRegras() {
  const qc = useQueryClient();
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const regras = useQuery(consultaRegras);
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const podeEditar = pode(acesso, "admin_bonificacao", "editar");
  const podeExcluir = pode(acesso, "admin_bonificacao", "excluir");

  const salvar = useGravacao({
    mutacao: mutacaoSalvarRegra(qc),
    sucesso: "Regra salva",
    aoConcluir: () => {
      setEditando(null);
    },
  });
  const excluir = useGravacao({ mutacao: mutacaoExcluirRegra(qc), sucesso: "Regra removida" });

  const [simulando, setSimulando] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  async function simular(id: string) {
    setSimulando(id);
    setSimulacao(null);
    try {
      setSimulacao(await simularRegra(id, mesAnterior(hoje)));
    } catch (e) {
      toast.error(mensagemAmigavel(e));
    } finally {
      setSimulando(null);
    }
  }

  const lista = regras.data ?? [];

  return (
    <Pagina
      titulo="Regras de bonificação"
      descricao="Defina critérios e simule antes de ativar"
      largura="estreita"
      acoes={
        <>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/admin/configuracoes"
              search={{ aba: "equipes" }}
              aria-label="Voltar para Equipes"
              title="Voltar para Equipes"
            >
              <ArrowLeft aria-hidden /> Voltar
            </Link>
          </Button>
          {podeEditar && (
            <Button
              size="sm"
              onClick={() => {
                setEditando(rascunhoVazio(hoje));
              }}
            >
              <Plus aria-hidden /> Nova regra
            </Button>
          )}
        </>
      }
    >
      {regras.isPending ? (
        <div className="space-y-4" aria-busy>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl bg-muted" />
          ))}
        </div>
      ) : regras.error ? (
        <Painel>
          <MensagemErro erro={regras.error} aoTentarDeNovo={() => void regras.refetch()} />
        </Painel>
      ) : lista.length === 0 ? (
        <Painel>
          <EstadoVazio
            icone={ListChecks}
            mensagem="Nenhuma regra cadastrada ainda."
            detalhe={podeEditar ? "Crie a primeira em “Nova regra”." : undefined}
          />
        </Painel>
      ) : (
        <div className="space-y-4">
          {lista.map((r) => (
            <CartaoDaRegra
              key={r.id}
              regra={r}
              simulacao={simulacao?.regraId === r.id ? simulacao : null}
              simulando={simulando === r.id}
              podeEditar={podeEditar}
              podeExcluir={podeExcluir}
              aoSimular={() => void simular(r.id)}
              aoEditar={() => {
                setEditando(rascunhoDaRegra(r));
              }}
              aoCopiar={() => {
                setEditando({
                  ...rascunhoDaRegra(r),
                  id: undefined,
                  nome: `${r.nome} (cópia)`,
                });
              }}
              aoExcluir={() => {
                if (window.confirm("Remover regra?")) void excluir.gravar(r.id);
              }}
            />
          ))}
        </div>
      )}

      {editando && (
        <ModalDaRegra
          inicial={editando}
          salvando={salvar.gravando}
          aoCancelar={() => {
            setEditando(null);
          }}
          aoSalvar={(d) => {
            void salvar.gravar(d);
          }}
        />
      )}
    </Pagina>
  );
}
