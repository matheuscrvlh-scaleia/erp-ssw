import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora } from "@erp/shared/formatacao";
import { AlertTriangle, Clock, RefreshCw, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { cn } from "@/lib/utils";

type Credenciais = SaidaDe<typeof c.credenciais>;

/** Selos de senha e token e as datas do token, das credenciais e da última verificação. */
export function SituacaoDasCredenciais({
  dados,
  erro,
  aoTentarDeNovo,
}: {
  dados: Credenciais | undefined;
  erro: Error | null;
  aoTentarDeNovo: () => void;
}) {
  const verificacao = dados?.ultimaVerificacao ?? null;
  return erro ? (
    <MensagemErro
      erro={erro}
      titulo="Não foi possível carregar as credenciais"
      aoTentarDeNovo={aoTentarDeNovo}
    />
  ) : (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {dados?.temSenha ? (
          <SeloStatus tom="sucesso" icone={ShieldCheck}>
            Senha cadastrada
          </SeloStatus>
        ) : (
          <SeloStatus tom="alerta" icone={AlertTriangle}>
            Sem senha
          </SeloStatus>
        )}
        {dados?.tokenStatus === "valido" && (
          <SeloStatus tom="sucesso" icone={ShieldCheck}>
            Token válido
          </SeloStatus>
        )}
        {dados?.tokenStatus === "expirado" && (
          <SeloStatus tom="alerta" icone={ShieldAlert}>
            Token expirado
          </SeloStatus>
        )}
        {dados?.tokenStatus === "ausente" && (
          <SeloStatus tom="neutro" icone={ShieldOff}>
            Token ausente
          </SeloStatus>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground tabular-nums md:text-right">
        {dados?.tokenAtualizadoEm ? (
          <div className="flex items-center gap-1.5 md:justify-end">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Gerado em {formatarDataHora(dados.tokenAtualizadoEm)}
          </div>
        ) : (
          <div>Nenhum token gerado ainda (TTL {dados?.ttlHoras ?? 4}h).</div>
        )}
        {dados?.tokenExpiraEm && (
          <div>
            {dados.tokenStatus === "valido" ? "Expira em " : "Expirou em "}
            {formatarDataHora(dados.tokenExpiraEm)}
          </div>
        )}
        {dados?.atualizadoEm && (
          <div>Credenciais atualizadas em {formatarDataHora(dados.atualizadoEm)}</div>
        )}
        {verificacao ? (
          <div
            className={cn(
              "flex items-center gap-1.5 md:justify-end",
              !verificacao.ok && "font-medium text-status-bad-fg",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Última verificação: {formatarDataHora(verificacao.em)}
            {verificacao.ok ? " · OK" : " · falhou"}
          </div>
        ) : (
          <div>Aguardando a primeira verificação automática (a cada hora).</div>
        )}
      </div>
    </div>
  );
}
