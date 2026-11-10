import { ehAdminDaEmpresa,PAPEL_GESTOR } from "@erp/shared/acesso/papeis";
import { contratosRanking as c, type Equipe } from "@erp/shared/contratos/ranking";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Link2, Plus, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";

import { CHAVE_DAS_EQUIPES, consultaCtesParaAtribuir, consultaEquipes } from "./api";
import { isoLocal } from "./periodo";

const mensagemDe = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.";

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
  const podeGravar =
    ehAdminDaEmpresa(acesso.papel) || acesso.papel === PAPEL_GESTOR || acesso.adminPlataforma;
  const qc = useQueryClient();
  const { data } = useQuery(consultaEquipes);
  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_DAS_EQUIPES });

  const [nome, setNome] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  // O banco guarda só o hash: o link aparece para copiar na sessão em que foi gerado.
  const [linksGerados, setLinksGerados] = useState<Record<string, string>>({});

  const criar = useMutation({
    mutationFn: () =>
      chamar(c.salvarEquipe, {
        entrada: { nome, unidadeId: unidadeId || null, ativo: true },
      }),
    onSuccess: () => {
      toast.success("Equipe criada");
      setNome("");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDe(e)),
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
    onError: (e) => toast.error(mensagemDe(e)),
  });
  const remover = useMutation({
    mutationFn: (id: string) => chamar(c.removerMembro, { parametros: { id } }),
    onSuccess: () => void atualizar(),
    onError: (e) => toast.error(mensagemDe(e)),
  });
  const gerar = useMutation({
    mutationFn: (id: string) => chamar(c.gerarLink, { parametros: { id } }),
    onSuccess: (r, id) => {
      const url = urlDoLink(r.token);
      setLinksGerados((atual) => ({ ...atual, [id]: url }));
      copiar(url, "Link gerado e copiado");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDe(e)),
  });
  const revogar = useMutation({
    mutationFn: (id: string) => chamar(c.revogarLink, { parametros: { id } }),
    onSuccess: (_r, id) => {
      setLinksGerados(({ [id]: _removido, ...resto }) => resto);
      toast.success("Token revogado");
      void atualizar();
    },
    onError: (e) => toast.error(mensagemDe(e)),
  });

  const unidades = data?.unidades ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Equipes de entrega</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre equipes, gere links e atribua CTRCs.
        </p>
      </header>

      {podeGravar && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium">Nova equipe</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nome da equipe (ex.: Equipe Cabo Frio A)"
              value={nome}
              onChange={(e) => { setNome(e.target.value); }}
            />
            <select
              aria-label="Unidade"
              value={unidadeId}
              onChange={(e) => { setUnidadeId(e.target.value); }}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Sem unidade</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
            <Button onClick={() => { criar.mutate(); }} disabled={!nome.trim() || criar.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Criar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(data?.equipes ?? []).map((e) => {
          const membros = (data?.membros ?? []).filter((m) => m.equipeId === e.id);
          const link = linksGerados[e.id];
          return (
            <div key={e.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <UsersRound className="h-4 w-4" /> {e.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {unidades.find((u) => u.id === e.unidadeId)?.nome ?? "sem unidade"}
                  </div>
                </div>
                {podeGravar && (
                  <BotoesDoLink
                    equipe={e}
                    link={link}
                    aoGerar={() => { gerar.mutate(e.id); }}
                    aoRevogar={() => { revogar.mutate(e.id); }}
                  />
                )}
              </div>

              <div className="mt-3 space-y-1">
                {membros.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="text-muted-foreground">
                        [{m.papel === "motorista" ? "Motorista" : `Ajudante ${m.posicao ?? "-"}`}]
                      </span>{" "}
                      {m.nome}
                    </span>
                    {podeGravar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover ${m.nome}`}
                        onClick={() => { remover.mutate(m.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {podeGravar && (
                  <NovoMembro
                    ocupadas={membros.flatMap((m) =>
                      m.papel === "ajudante" && m.posicao !== null ? [m.posicao] : [],
                    )}
                    aoIncluir={(v) => { incluir.mutate({ ...v, equipeId: e.id }); }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AtribuirCtes equipes={data?.equipes ?? []} podeGravar={podeGravar} />
    </div>
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
        <Link2 className="mr-1 h-4 w-4" /> Gerar link público
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      {link ? (
        <Button size="sm" variant="outline" onClick={() => { copiar(link, "Link copiado"); }}>
          <Copy className="mr-1 h-4 w-4" /> Copiar link
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          title="Por segurança o link só aparece ao ser gerado. Gerar de novo troca o link antigo."
          onClick={aoGerar}
        >
          <Link2 className="mr-1 h-4 w-4" /> Gerar novo link
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={aoRevogar}>
        Revogar
      </Button>
    </div>
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
    <div className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        placeholder="Nome do membro"
        value={nome}
        onChange={(e) => { setNome(e.target.value); }}
      />
      <select
        aria-label="Papel"
        value={papel}
        onChange={(e) => { setPapel(e.target.value === "ajudante" ? "ajudante" : "motorista"); }}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        <option value="motorista">motorista</option>
        <option value="ajudante">ajudante</option>
      </select>
      {papel === "ajudante" ? (
        <select
          value={posicaoEfetiva ?? ""}
          onChange={(e) => { setPosicao(e.target.value ? Number(e.target.value) : null); }}
          disabled={semVaga}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
          aria-label="Posição do ajudante"
        >
          {semVaga ? <option value="">sem vaga</option> : null}
          {[1, 2, 3].map((p) => (
            <option key={p} value={p} disabled={ocupadasSet.has(p)}>
              Ajudante {p}
              {ocupadasSet.has(p) ? " (ocupado)" : ""}
            </option>
          ))}
        </select>
      ) : null}
      <Button
        size="sm"
        aria-label="Incluir membro"
        disabled={bloqueado}
        title={
          papel === "ajudante" && semVaga ? "Esta equipe já tem 3 ajudantes ativos" : undefined
        }
        onClick={() => {
          aoIncluir({ nome, papel, posicao: papel === "ajudante" ? posicaoEfetiva : null });
          setNome("");
          setPosicao(null);
        }}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AtribuirCtes({ equipes, podeGravar }: { equipes: Equipe[]; podeGravar: boolean }) {
  const qc = useQueryClient();
  const hoje = new Date();
  const [inicio, setInicio] = useState(isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [fim, setFim] = useState(isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [equipeAlvo, setEquipeAlvo] = useState("");
  const { data, refetch } = useQuery(consultaCtesParaAtribuir(inicio, fim));

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
    onError: (e) => toast.error(mensagemDe(e)),
  });

  const ctes = data?.ctes ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-400" /> Atribuir CTRCs sem equipe
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="date"
          aria-label="De"
          value={inicio}
          onChange={(e) => { setInicio(e.target.value); }}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <input
          type="date"
          aria-label="Até"
          value={fim}
          onChange={(e) => { setFim(e.target.value); }}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        {podeGravar && (
          <>
            <select
              aria-label="Equipe"
              value={equipeAlvo}
              onChange={(e) => { setEquipeAlvo(e.target.value); }}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Selecione equipe…</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={selecionados.size === 0 || !equipeAlvo || atribuir.isPending}
              onClick={() => { atribuir.mutate(); }}
            >
              Atribuir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
            </Button>
          </>
        )}
      </div>
      <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left">
            <tr>
              <th className="p-2" />
              <th className="p-2">CTRC</th>
              <th className="p-2">Emissão</th>
              <th className="p-2">Destino</th>
              <th className="p-2">Motorista (SSW)</th>
            </tr>
          </thead>
          <tbody>
            {ctes.map((cte) => (
              <tr key={cte.id} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${cte.sigla}${cte.numero}`}
                    disabled={!podeGravar}
                    checked={selecionados.has(cte.id)}
                    onChange={(e) => {
                      const novos = new Set(selecionados);
                      if (e.target.checked) novos.add(cte.id);
                      else novos.delete(cte.id);
                      setSelecionados(novos);
                    }}
                  />
                </td>
                <td className="p-2 font-mono">
                  {cte.sigla}
                  {cte.numero}
                </td>
                <td className="p-2">{cte.dataEmissao}</td>
                <td className="p-2">
                  {cte.cidadeDestino}/{cte.ufDestino}
                </td>
                <td className="p-2">{cte.motoristaNome ?? "—"}</td>
              </tr>
            ))}
            {ctes.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  Nenhum CTRC sem equipe no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
