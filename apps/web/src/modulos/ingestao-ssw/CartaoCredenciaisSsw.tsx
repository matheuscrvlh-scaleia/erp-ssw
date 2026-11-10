import { contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";

import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { CHAVE_DA_INGESTAO, consultaCredenciais } from "./api";
import { Cartao } from "./Cartao";

const MENSAGEM_DA_FALHA = {
  upstream_unavailable: "SSW está com instabilidade — não é problema das credenciais.",
  permission_denied: "O usuário da API não tem permissão no SSW.",
  auth_failed: "O SSW recusou o login. Revise usuário, senha e domínio.",
} as const;

/**
 * Credenciais da SSW API (a senha nunca volta para a tela) e "Testar conexão", que roda o
 * heartbeat do token agora.
 * origem: features/ssw/components/SswCredenciaisCard.tsx (sistema atual)
 */
export function CartaoCredenciaisSsw() {
  const queryClient = useQueryClient();
  const consulta = useQuery(consultaCredenciais);
  const dados = consulta.data;
  const [dominio, setDominio] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const cnpjDigitos = cnpj.replace(/\D/g, "");
  const cnpjOk = cnpjDigitos === "" || cnpjDigitos.length === 14;
  const preenchido = Boolean(dominio.trim() || usuario.trim() || senha || cnpjDigitos);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE_DA_INGESTAO });

  const salvar = useMutation({
    mutationFn: () =>
      chamar(c.salvarCredenciais, {
        entrada: {
          ...(dominio.trim() ? { dominio: dominio.trim() } : {}),
          ...(usuario.trim() ? { usuario: usuario.trim() } : {}),
          ...(senha ? { senha } : {}),
          ...(cnpjDigitos ? { cnpjEdi: cnpjDigitos } : {}),
        },
      }),
    onSuccess: async (r) => {
      toast.success(
        r.tokenInvalidado
          ? "Credenciais salvas. O token antigo foi descartado; teste a conexão."
          : "Credenciais salvas.",
      );
      setDominio("");
      setUsuario("");
      setSenha("");
      setCnpj("");
      await atualizar();
    },
    onError: (e) =>
      toast.error("Não foi possível salvar as credenciais", { description: mensagemAmigavel(e) }),
  });

  const testar = useMutation({
    mutationFn: () => chamar(c.testarConexao),
    onSuccess: async (r) => {
      if (r.pendente) toast.info(r.mensagem);
      else if (r.ok) toast.success(r.renovado ? "Conexão OK · token renovado" : "Conexão OK");
      else toast.error("Falha na conexão com a SSW", { description: r.mensagem });
      await atualizar();
    },
    onError: (e) =>
      toast.error("Não foi possível testar a conexão", { description: mensagemAmigavel(e) }),
  });

  const aoSalvar = (e: SyntheticEvent) => {
    e.preventDefault();
    if (preenchido && cnpjOk) salvar.mutate();
  };

  const verificacao = dados?.ultimaVerificacao ?? null;
  const resultado = testar.data;

  return (
    <Cartao
      titulo="Credenciais da SSW API"
      icone={<KeyRound className="h-4 w-4" aria-hidden />}
      direita={dados && !dados.ativo ? "integração desligada na empresa" : undefined}
    >
      {consulta.error ? (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar as credenciais"
          aoTentarDeNovo={() => void consulta.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {dados?.temSenha ? (
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Senha cadastrada
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
                <AlertTriangle className="h-3 w-3" aria-hidden /> Sem senha
              </Badge>
            )}
            {dados?.tokenStatus === "valido" && (
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Token válido
              </Badge>
            )}
            {dados?.tokenStatus === "expirado" && (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
                <ShieldAlert className="h-3 w-3" aria-hidden /> Token expirado
              </Badge>
            )}
            {dados?.tokenStatus === "ausente" && (
              <Badge
                variant="outline"
                className="gap-1 border-muted-foreground/40 text-muted-foreground"
              >
                <ShieldOff className="h-3 w-3" aria-hidden /> Token ausente
              </Badge>
            )}
          </div>
          <div className="space-y-0.5 text-[10px] text-muted-foreground md:text-right">
            {dados?.tokenAtualizadoEm ? (
              <div className="flex items-center gap-1 md:justify-end">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
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
                className={`flex items-center gap-1 md:justify-end ${verificacao.ok ? "" : "text-destructive"}`}
              >
                <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
                Última verificação: {formatarDataHora(verificacao.em)}
                {verificacao.ok ? " · OK" : " · falhou"}
              </div>
            ) : (
              <div>Aguardando a primeira verificação automática (a cada hora).</div>
            )}
          </div>
        </div>
      )}

      {verificacao && !verificacao.ok && verificacao.mensagem && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[12px]"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-destructive">
              Renovação do token SSW falhou em {formatarDataHora(verificacao.em)}
            </div>
            <div className="mt-1 break-words text-foreground/80">{verificacao.mensagem}</div>
            <div className="mt-1 text-muted-foreground">
              Revise as credenciais abaixo e clique em &quot;Testar conexão&quot; para forçar uma
              nova tentativa.
            </div>
          </div>
        </div>
      )}

      <form className="space-y-3" onSubmit={aoSalvar}>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo
            id="ssw-dominio"
            rotulo="Domínio"
            valor={dominio}
            aoMudar={setDominio}
            dica={dados?.dominio || "ex.: FRT"}
          />
          <Campo
            id="ssw-usuario"
            rotulo="Usuário"
            valor={usuario}
            aoMudar={setUsuario}
            dica={dados?.usuario || "usuario.api"}
          />
          <div className="space-y-1">
            <Label htmlFor="ssw-senha" className="text-[12px]">
              Senha{" "}
              {dados?.temSenha && (
                <span className="text-muted-foreground">(deixe vazio para manter a atual)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="ssw-senha"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                }}
                placeholder={dados?.temSenha ? "••••••••" : "Digite a senha"}
                autoComplete="new-password"
                maxLength={256}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => {
                  setMostrarSenha((v) => !v);
                }}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Campo
              id="ssw-cnpj"
              rotulo="CNPJ EDI"
              valor={cnpj}
              aoMudar={setCnpj}
              dica={dados?.cnpjEdi || "14 dígitos"}
              numerico
            />
            {!cnpjOk && (
              <p className="text-[11px] text-destructive">O CNPJ precisa ter 14 dígitos.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!preenchido || !cnpjOk || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar credenciais"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testar.isPending}
            onClick={() => {
              testar.mutate();
            }}
          >
            <RefreshCw
              className={`mr-1.5 h-3 w-3 ${testar.isPending ? "animate-spin" : ""}`}
              aria-hidden
            />
            {testar.isPending ? "Testando…" : "Testar conexão"}
          </Button>
        </div>
      </form>

      {resultado && !resultado.pendente && (
        <div
          className={`rounded-md border p-3 text-[12px] ${resultado.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}
        >
          <div className="font-medium">
            {resultado.ok ? "Conexão OK" : "Falha na conexão"}
            {resultado.renovado && " · token renovado"}
            {resultado.tokenPrevia && (
              <span className="ml-1 font-mono text-muted-foreground">{resultado.tokenPrevia}</span>
            )}
          </div>
          <div className="break-words text-muted-foreground">{resultado.mensagem}</div>
          {resultado.tipoFalha && (
            <div className="text-muted-foreground">{MENSAGEM_DA_FALHA[resultado.tipoFalha]}</div>
          )}
        </div>
      )}
    </Cartao>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
  dica,
  numerico = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica: string;
  numerico?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[12px]">
        {rotulo}
      </Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        placeholder={dica}
        autoComplete="off"
        maxLength={numerico ? 18 : 64}
        {...(numerico ? { inputMode: "numeric" as const } : {})}
      />
    </div>
  );
}
