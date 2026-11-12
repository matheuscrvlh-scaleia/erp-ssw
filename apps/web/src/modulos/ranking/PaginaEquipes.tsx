import { hojeNoFuso } from "@erp/shared/datas";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { useGravacao } from "@/hooks/use-gravacao";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { mesDe, periodoDoMes } from "@/lib/periodo-do-mes";

import {
  consultaCtesParaAtribuir,
  consultaEquipes,
  mutacaoAtribuirCtes,
  mutacaoCriarEquipe,
  mutacaoGerarLink,
  mutacaoIncluirMembro,
  mutacaoRemoverMembro,
  mutacaoRevogarLink,
} from "./api";
import { CartaoDaEquipe } from "./componentes/CartaoDaEquipe";
import { TabelaDeAtribuicao } from "./componentes/TabelaDeAtribuicao";

// O Select não aceita valor vazio num item: "sem unidade" viaja com esta marca.
const SEM_UNIDADE = "__sem_unidade__";

function urlDoLink(token: string): string {
  return `${window.location.origin}/ranking/publico/${token}`;
}

function copiar(texto: string, aviso: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.message(texto),
  );
}

const avisarErro = (e: unknown) => toast.error(mensagemAmigavel(e));

/** origem: routes/_authenticated/admin.equipes.tsx (sistema atual) */
export function PaginaEquipes() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const podeGravar = pode(acesso, "admin_equipes", "editar");
  const podeRemover = pode(acesso, "admin_equipes", "excluir");
  const qc = useQueryClient();
  const equipes = useQuery(consultaEquipes);
  const data = equipes.data;

  const [nome, setNome] = useState("");
  const [unidadeId, setUnidadeId] = useState(SEM_UNIDADE);
  // O banco guarda só o hash: o link aparece para copiar na sessão em que foi gerado.
  const [linksGerados, setLinksGerados] = useState<Record<string, string>>({});

  const criar = useGravacao({
    mutacao: mutacaoCriarEquipe(qc),
    sucesso: "Equipe criada",
    aoConcluir: () => {
      setNome("");
    },
  });
  const incluir = useMutation(mutacaoIncluirMembro(qc));
  const remover = useMutation(mutacaoRemoverMembro(qc));
  const gerar = useMutation(mutacaoGerarLink(qc));
  const revogar = useMutation(mutacaoRevogarLink(qc));

  const gerarLink = (id: string) => {
    gerar.mutateAsync(id).then((r) => {
      const url = urlDoLink(r.token);
      setLinksGerados((atual) => ({ ...atual, [id]: url }));
      copiar(url, "Link gerado e copiado");
    }, avisarErro);
  };
  const revogarLink = (id: string) => {
    revogar.mutateAsync(id).then(() => {
      setLinksGerados(({ [id]: _removido, ...resto }) => resto);
      toast.success("Token revogado");
    }, avisarErro);
  };

  // Atribuição de CTRCs sem equipe: período do mês corrente no fuso da empresa.
  const doMes = periodoDoMes(mesDe(hojeNoFuso(useFusoDaEmpresa())));
  const [inicio, setInicio] = useState(doMes.inicio);
  const [fim, setFim] = useState(doMes.fim);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [equipeAlvo, setEquipeAlvo] = useState("");
  const paraAtribuir = useQuery(consultaCtesParaAtribuir(inicio, fim));
  const atribuir = useGravacao({
    mutacao: mutacaoAtribuirCtes(qc),
    sucesso: (_entrada, r) => `${r.quantidade} CTRC(s) atribuído(s)`,
    aoConcluir: () => {
      setSelecionados(new Set());
    },
  });

  const unidades = data?.unidades ?? [];

  return (
    <Pagina titulo="Equipes de entrega" descricao="Cadastre equipes, gere links e atribua CTRCs.">
      {podeGravar && (
        <Painel titulo="Nova equipe" classeDoCorpo="flex flex-wrap gap-2 p-4">
          <Input
            className="min-w-[200px] flex-1 text-[13px]"
            aria-label="Nome da equipe"
            placeholder="Nome da equipe (ex.: Equipe Cabo Frio A)"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
            }}
          />
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger className="w-full text-[13px] sm:w-52" aria-label="Unidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_UNIDADE}>Sem unidade</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              void criar.gravar({
                nome,
                unidadeId: unidadeId === SEM_UNIDADE ? null : unidadeId,
                ativo: true,
              });
            }}
            disabled={!nome.trim() || criar.gravando}
          >
            <Plus aria-hidden /> Criar
          </Button>
        </Painel>
      )}

      {equipes.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl bg-muted" />
          ))}
        </div>
      ) : equipes.error ? (
        <Painel>
          <MensagemErro erro={equipes.error} aoTentarDeNovo={() => void equipes.refetch()} />
        </Painel>
      ) : (data?.equipes ?? []).length === 0 ? (
        <Painel>
          <EstadoVazio
            icone={UsersRound}
            mensagem="Nenhuma equipe cadastrada."
            detalhe={podeGravar ? "Crie a primeira no quadro “Nova equipe”." : undefined}
          />
        </Painel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {(data?.equipes ?? []).map((e) => (
            <CartaoDaEquipe
              key={e.id}
              equipe={e}
              membros={(data?.membros ?? []).filter((m) => m.equipeId === e.id)}
              unidade={unidades.find((u) => u.id === e.unidadeId)?.nome ?? "sem unidade"}
              podeGravar={podeGravar}
              podeRemover={podeRemover}
              link={linksGerados[e.id]}
              aoGerarLink={() => {
                gerarLink(e.id);
              }}
              aoCopiarLink={(link) => {
                copiar(link, "Link copiado");
              }}
              aoRevogarLink={() => {
                revogarLink(e.id);
              }}
              aoRemoverMembro={(id) => {
                remover.mutateAsync(id).catch(avisarErro);
              }}
              aoIncluirMembro={(v) => {
                incluir.mutateAsync({ ...v, equipeId: e.id }).catch(avisarErro);
              }}
            />
          ))}
        </div>
      )}

      <TabelaDeAtribuicao
        inicio={inicio}
        fim={fim}
        aoMudarInicio={setInicio}
        aoMudarFim={setFim}
        equipes={data?.equipes ?? []}
        equipeAlvo={equipeAlvo}
        aoMudarEquipe={setEquipeAlvo}
        podeGravar={podeGravar}
        ctes={paraAtribuir.data?.ctes ?? []}
        carregando={paraAtribuir.isPending}
        erro={paraAtribuir.error}
        aoTentarDeNovo={() => void paraAtribuir.refetch()}
        selecionados={selecionados}
        aoMudarSelecionados={setSelecionados}
        atribuindo={atribuir.gravando}
        aoAtribuir={() => {
          void atribuir.gravar({ cteIds: [...selecionados], equipeId: equipeAlvo || null });
        }}
      />
    </Pagina>
  );
}
