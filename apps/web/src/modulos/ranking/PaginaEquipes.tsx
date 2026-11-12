import { contratosRanking as c, type Equipe } from "@erp/shared/contratos/ranking";
import { hojeNoFuso } from "@erp/shared/datas";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Link2, Plus, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
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
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CHAVE_DAS_EQUIPES, consultaCtesParaAtribuir, consultaEquipes } from "./api";
import { mesDe, periodoDoMes } from "./periodo";

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

/** origem: routes/_authenticated/admin.equipes.tsx (sistema atual) */
export function PaginaEquipes() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const podeGravar = pode(acesso, "admin_equipes", "editar");
  const podeRemover = pode(acesso, "admin_equipes", "excluir");
  const qc = useQueryClient();
  const equipes = useQuery(consultaEquipes);
  const data = equipes.data;
  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_DAS_EQUIPES });

  const [nome, setNome] = useState("");
  const [unidadeId, setUnidadeId] = useState(SEM_UNIDADE);
  // O banco guarda só o hash: o link aparece para copiar na sessão em que foi gerado.
  const [linksGerados, setLinksGerados] = useState<Record<string, string>>({});

  const criar = useMutation({
    mutationFn: () =>
      chamar(c.salvarEquipe, {
        entrada: { nome, unidadeId: unidadeId === SEM_UNIDADE ? null : unidadeId, ativo: true },
      }),
    onSuccess: () => {
      toast.success("Equipe criada");
      setNome("");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const incluir = useMutation({
    mutationFn: (v: {
      equipeId: string;
      nome: string;
      papel: "motorista" | "ajudante";
      posicao: number | null;
    }) =>
      chamar(c.incluirMembro, {
        parametros: { id: v.equipeId },
        entrada: { nome: v.nome, papel: v.papel, posicao: v.posicao },
      }),
    onSuccess: () => void atualizar(),
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const remover = useMutation({
    mutationFn: (id: string) => chamar(c.removerMembro, { parametros: { id } }),
    onSuccess: () => void atualizar(),
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const gerar = useMutation({
    mutationFn: (id: string) => chamar(c.gerarLink, { parametros: { id } }),
    onSuccess: (r, id) => {
      const url = urlDoLink(r.token);
      setLinksGerados((atual) => ({ ...atual, [id]: url }));
      copiar(url, "Link gerado e copiado");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });
  const revogar = useMutation({
    mutationFn: (id: string) => chamar(c.revogarLink, { parametros: { id } }),
    onSuccess: (_r, id) => {
      setLinksGerados(({ [id]: _removido, ...resto }) => resto);
      toast.success("Token revogado");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
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
              criar.mutate();
            }}
            disabled={!nome.trim() || criar.isPending}
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
          {(data?.equipes ?? []).map((e) => {
            const membros = (data?.membros ?? []).filter((m) => m.equipeId === e.id);
            return (
              <Painel
                key={e.id}
                titulo={
                  <span className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {e.nome}
                  </span>
                }
                descricao={unidades.find((u) => u.id === e.unidadeId)?.nome ?? "sem unidade"}
                acoes={
                  podeGravar && (
                    <BotoesDoLink
                      equipe={e}
                      link={linksGerados[e.id]}
                      aoGerar={() => {
                        gerar.mutate(e.id);
                      }}
                      aoRevogar={() => {
                        revogar.mutate(e.id);
                      }}
                    />
                  )
                }
              >
                <ul className="divide-y divide-border">
                  {membros.map((m) => (
                    <li key={m.id} className="flex min-h-11 items-center gap-2 px-5 py-1.5">
                      <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border bg-muted px-2 text-xs font-medium text-muted-foreground">
                        {m.papel === "motorista" ? "Motorista" : `Ajudante ${m.posicao ?? "-"}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{m.nome}</span>
                      {podeRemover && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-status-bad-fg"
                          aria-label={`Remover ${m.nome}`}
                          title={`Remover ${m.nome}`}
                          onClick={() => {
                            remover.mutate(m.id);
                          }}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {podeGravar && (
                  <NovoMembro
                    ocupadas={membros.flatMap((m) =>
                      m.papel === "ajudante" && m.posicao !== null ? [m.posicao] : [],
                    )}
                    aoIncluir={(v) => {
                      incluir.mutate({ ...v, equipeId: e.id });
                    }}
                  />
                )}
              </Painel>
            );
          })}
        </div>
      )}

      <AtribuirCtes equipes={data?.equipes ?? []} podeGravar={podeGravar} />
    </Pagina>
  );
}

function BotoesDoLink({
  equipe,
  link,
  aoGerar,
  aoRevogar,
}: {
  equipe: Equipe;
  link: string | undefined;
  aoGerar: () => void;
  aoRevogar: () => void;
}) {
  if (!equipe.linkAtivo) {
    return (
      <Button size="sm" variant="outline" onClick={aoGerar}>
        <Link2 aria-hidden /> Gerar link público
      </Button>
    );
  }
  return (
    <>
      {link ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            copiar(link, "Link copiado");
          }}
        >
          <Copy aria-hidden /> Copiar link
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          title="Por segurança o link só aparece ao ser gerado. Gerar de novo troca o link antigo."
          onClick={aoGerar}
        >
          <Link2 aria-hidden /> Gerar novo link
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-status-bad-fg" onClick={aoRevogar}>
        Revogar
      </Button>
    </>
  );
}

function NovoMembro({
  aoIncluir,
  ocupadas,
}: {
  aoIncluir: (v: { nome: string; papel: "motorista" | "ajudante"; posicao: number | null }) => void;
  ocupadas: number[];
}) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"motorista" | "ajudante">("motorista");
  const [posicao, setPosicao] = useState<number | null>(null);
  const ocupadasSet = useMemo(() => new Set(ocupadas), [ocupadas]);
  const primeiraLivre = [1, 2, 3].find((p) => !ocupadasSet.has(p)) ?? null;
  const posicaoEfetiva = posicao !== null && !ocupadasSet.has(posicao) ? posicao : primeiraLivre;
  const semVaga = primeiraLivre === null;
  const bloqueado = !nome.trim() || (papel === "ajudante" && semVaga);
  return (
    <div className="flex flex-wrap gap-2 border-t border-border bg-superficie/60 px-5 py-3">
      <Input
        className="h-8 min-w-[160px] flex-1 text-[13px]"
        aria-label="Nome do membro"
        placeholder="Nome do membro"
        value={nome}
        onChange={(e) => {
          setNome(e.target.value);
        }}
      />
      <Select
        value={papel}
        onValueChange={(v) => {
          setPapel(v === "ajudante" ? "ajudante" : "motorista");
        }}
      >
        <SelectTrigger className="h-8 w-32 text-[13px]" aria-label="Papel">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="motorista">motorista</SelectItem>
          <SelectItem value="ajudante">ajudante</SelectItem>
        </SelectContent>
      </Select>
      {papel === "ajudante" ? (
        <Select
          value={posicaoEfetiva === null ? "" : String(posicaoEfetiva)}
          onValueChange={(v) => {
            setPosicao(v ? Number(v) : null);
          }}
          disabled={semVaga}
        >
          <SelectTrigger className="h-8 w-44 text-[13px]" aria-label="Posição do ajudante">
            <SelectValue placeholder="sem vaga" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((p) => (
              <SelectItem key={p} value={String(p)} disabled={ocupadasSet.has(p)}>
                Ajudante {p}
                {ocupadasSet.has(p) ? " (ocupado)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button
        size="icon"
        className="h-8 w-8"
        aria-label="Incluir membro"
        disabled={bloqueado}
        title={
          papel === "ajudante" && semVaga
            ? "Esta equipe já tem 3 ajudantes ativos"
            : "Incluir membro"
        }
        onClick={() => {
          aoIncluir({ nome, papel, posicao: papel === "ajudante" ? posicaoEfetiva : null });
          setNome("");
          setPosicao(null);
        }}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

function AtribuirCtes({ equipes, podeGravar }: { equipes: Equipe[]; podeGravar: boolean }) {
  const qc = useQueryClient();
  const doMes = periodoDoMes(mesDe(hojeNoFuso(useFusoDaEmpresa())));
  const [inicio, setInicio] = useState(doMes.inicio);
  const [fim, setFim] = useState(doMes.fim);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [equipeAlvo, setEquipeAlvo] = useState("");
  const { data, error, isPending, refetch } = useQuery(consultaCtesParaAtribuir(inicio, fim));

  const atribuir = useMutation({
    mutationFn: () =>
      chamar(c.atribuir, {
        entrada: { cteIds: [...selecionados], equipeId: equipeAlvo || null },
      }),
    onSuccess: (r) => {
      toast.success(`${r.quantidade} CTRC(s) atribuído(s)`);
      setSelecionados(new Set());
      void refetch();
      void qc.invalidateQueries({ queryKey: ["ranking-calculo"] });
    },
    onError: (e) => toast.error(mensagemAmigavel(e)),
  });

  const ctes = data?.ctes ?? [];
  return (
    <Painel
      titulo="Atribuir CTRCs sem equipe"
      icone={AlertTriangle}
      barra={
        <>
          <Input
            type="date"
            aria-label="De"
            className="h-9 w-auto text-[13px]"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
            }}
          />
          <Input
            type="date"
            aria-label="Até"
            className="h-9 w-auto text-[13px]"
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
            }}
          />
          {podeGravar && (
            <>
              <Select value={equipeAlvo} onValueChange={setEquipeAlvo}>
                <SelectTrigger className="w-56 text-[13px]" aria-label="Equipe">
                  <SelectValue placeholder="Selecione equipe…" />
                </SelectTrigger>
                <SelectContent>
                  {equipes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={selecionados.size === 0 || !equipeAlvo || atribuir.isPending}
                onClick={() => {
                  atribuir.mutate();
                }}
              >
                Atribuir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="rolagem-fina relative max-h-80 overflow-auto rounded-xl">
        <table className={CLASSE_TABELA}>
          <thead>
            <tr className={cn(CLASSE_CABECALHO, "sticky top-0 z-10 bg-muted")}>
              <th scope="col" className={cn(CLASSE_TH, "w-10")}>
                <span className="sr-only">Selecionar</span>
              </th>
              <th scope="col" className={CLASSE_TH}>
                CTRC
              </th>
              <th scope="col" className={CLASSE_TH}>
                Emissão
              </th>
              <th scope="col" className={CLASSE_TH}>
                Destino
              </th>
              <th scope="col" className={CLASSE_TH}>
                Motorista (SSW)
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending && <LinhasCarregando linhas={4} colunas={5} />}
            {error && (
              <tr>
                <td colSpan={5}>
                  <MensagemErro erro={error} aoTentarDeNovo={() => void refetch()} />
                </td>
              </tr>
            )}
            {ctes.map((cte) => (
              <tr
                key={cte.id}
                className={cn(CLASSE_LINHA, selecionados.has(cte.id) && "bg-accent")}
              >
                <td className={CLASSE_TD}>
                  <Checkbox
                    aria-label={`Selecionar ${cte.sigla}${cte.numero}`}
                    disabled={!podeGravar}
                    checked={selecionados.has(cte.id)}
                    onCheckedChange={(marcado) => {
                      const novos = new Set(selecionados);
                      if (marcado === true) novos.add(cte.id);
                      else novos.delete(cte.id);
                      setSelecionados(novos);
                    }}
                  />
                </td>
                <td className={cn(CLASSE_TD, "font-mono")}>
                  {cte.sigla}
                  {cte.numero}
                </td>
                <td className={CLASSE_TD}>{cte.dataEmissao}</td>
                <td className={CLASSE_TD}>
                  {cte.cidadeDestino}/{cte.ufDestino}
                </td>
                <td className={CLASSE_TD}>{cte.motoristaNome ?? "—"}</td>
              </tr>
            ))}
            {!isPending && !error && ctes.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EstadoVazio
                    mensagem="Nenhum CTRC sem equipe no período."
                    detalhe="Amplie as datas para procurar mais."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}
