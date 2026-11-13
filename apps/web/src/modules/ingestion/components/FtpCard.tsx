/** Sincronização automática do FTP (relatórios SSW): andamento, última execução e controles. */
import { type SaidaDe } from "@erp/shared/contract";
import { type contratosIngestao } from "@erp/shared/contracts/ingestion";
import { formatarDataHora } from "@erp/shared/formatting";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Server, Unlock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/components/common/ErrorMessage";
import { Painel } from "@/components/common/Panel";
import { SeloDaSituacao } from "@/components/common/SituationBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { mensagemAmigavel } from "@/lib/error-message";
import { cn } from "@/lib/utils";

import { mutacaoLiberarTravaFtp, mutacaoPausarFtp, mutacaoRodarFtp } from "../api";
import { proximaExecucao } from "../rules";
import { dataHora } from "../texts";
import { ConfirmarAcao } from "./ConfirmAction";
import { BarraDeProgresso } from "./ProgressBar";

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <dt className="label-xs">{rotulo}</dt>
      <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function CartaoFtp({
  dados,
  erro,
  aoTentarDeNovo,
}: {
  dados: SaidaDe<typeof contratosIngestao.ftp> | undefined;
  erro: Error | null;
  aoTentarDeNovo: () => void;
}) {
  const queryClient = useQueryClient();
  const pausar = useMutation(mutacaoPausarFtp(queryClient));
  const rodar = useMutation(mutacaoRodarFtp(queryClient));
  const liberarTrava = useMutation(mutacaoLiberarTravaFtp(queryClient));
  const [agindo, setAgindo] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const ultima = dados?.historico[0];
  const p = dados?.progresso;
  const rodando = dados?.travaAtiva ?? false;

  /** Marca a ação em andamento; o toast sai e os botões voltam antes de o cache ser invalidado (como hoje). */
  const agir = (sucesso: string) => {
    setAgindo(true);
    return {
      aoTerminar: (_: unknown, e: Error | null) => {
        if (e) toast.error("Não foi possível concluir", { description: mensagemAmigavel(e) });
        else toast.success(sucesso);
        setAgindo(false);
      },
    };
  };

  return (
    <Painel
      icone={Server}
      titulo="Sincronização automática FTP"
      descricao={
        dados ? `Horário: ${dados.agenda}` : "Relatórios do SSW depositados no SFTP da empresa."
      }
      barra={
        <>
          <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium shadow-cartao">
            <Switch
              checked={dados?.ativo ?? true}
              disabled={!dados || agindo}
              onCheckedChange={(ativo) => {
                pausar.mutate({
                  ativo,
                  ...agir(ativo ? "Sincronização retomada" : "Sincronização pausada"),
                });
              }}
            />
            {dados?.ativo === false ? "Pausada" : "Ativa"}
          </label>
          <Button
            size="sm"
            disabled={agindo || rodando}
            onClick={() => {
              rodar.mutate(agir("Sincronização iniciada. Acompanhe o andamento abaixo."));
            }}
          >
            <Play aria-hidden /> Rodar agora
          </Button>
        </>
      }
    >
      {erro ? (
        <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
      ) : (
        <>
          {rodando && p && (
            <div className="space-y-2.5 rounded-t-xl border-b border-border bg-status-info-bg/60 px-5 py-4 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span role="status" className="flex min-w-0 flex-wrap items-center gap-2">
                  <Loader2
                    className="h-4 w-4 shrink-0 text-status-info-fg motion-safe:animate-spin"
                    aria-hidden
                  />
                  <span className="font-semibold text-foreground">
                    {p.fase === "conectando"
                      ? "Conectando ao SFTP…"
                      : `Arquivo ${p.arquivoAtualIndice} de ${p.totalArquivos}`}
                  </span>
                  {p.arquivoAtualNome && (
                    <span className="truncate font-mono text-xs">{p.arquivoAtualNome}</span>
                  )}
                  {p.mensagem && <span className="text-muted-foreground">· {p.mensagem}</span>}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-status-bad-fg hover:bg-status-bad-bg hover:text-status-bad-fg"
                  disabled={agindo}
                  onClick={() => {
                    setLiberando(true);
                  }}
                >
                  <Unlock aria-hidden /> Liberar trava
                </Button>
              </div>
              <BarraDeProgresso
                valor={p.totalArquivos > 0 ? p.arquivoAtualIndice / p.totalArquivos : 0}
                rotulo="Andamento da sincronização"
              />
              <p className="text-xs text-muted-foreground">
                Último sinal: {dataHora(p.heartbeatEm)}
              </p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            <Dado rotulo="Última execução">
              {dataHora(ultima?.executadoEm)} {ultima && <SeloDaSituacao status={ultima.status} />}
            </Dado>
            <Dado rotulo="Processados">{ultima?.arquivosProcessados ?? "—"}</Dado>
            <Dado rotulo="Com erro">
              <span
                className={cn(
                  ultima !== undefined && ultima.arquivosComErro > 0 && "text-status-bad-fg",
                )}
              >
                {ultima?.arquivosComErro ?? "—"}
              </span>
            </Dado>
            <Dado rotulo="Próxima execução">
              {dados?.ativo === false
                ? "Pausada"
                : formatarDataHora(proximaExecucao(new Date()).toISOString())}
            </Dado>
          </dl>
          {ultima && (Boolean(ultima.mensagem) || ultima.erros.length > 0) && (
            <div className="space-y-3 border-t border-border px-5 py-4 text-[13px]">
              {ultima.mensagem && <p>{ultima.mensagem}</p>}
              {ultima.erros.length > 0 && (
                <details className="rounded-xl border border-border">
                  <summary className="cursor-pointer rounded-xl px-3 py-2 font-medium text-status-bad-fg hover:bg-muted/60">
                    Ver erros ({ultima.erros.length})
                  </summary>
                  <ul className="rolagem-fina max-h-48 space-y-1 overflow-auto border-t border-border px-3 py-2 font-mono text-xs">
                    {ultima.erros.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}
      <ConfirmarAcao
        aberto={liberando}
        aoMudarAberto={setLiberando}
        titulo="Liberar a trava?"
        descricao="Use só se a sincronização travou (sem andamento há minutos)."
        rotuloDoBotao="Liberar trava"
        aoConfirmar={() => {
          liberarTrava.mutate(agir("Trava liberada"));
        }}
      />
    </Painel>
  );
}
