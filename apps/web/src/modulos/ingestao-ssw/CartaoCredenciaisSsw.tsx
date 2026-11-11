import { contratosIngestaoSsw as c } from "@erp/shared/contratos/ingestao-ssw";
import { formatarDataHora } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";

import { Aviso } from "@/componentes/comum/Aviso";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { CHAVE_DA_INGESTAO, consultaCredenciais } from "./api";

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
    <Painel
      icone={KeyRound}
      titulo="Credenciais da SSW API"
      descricao={
        dados && !dados.ativo ? (
          <SeloStatus tom="neutro" icone={PowerOff}>
            integração desligada na empresa
          </SeloStatus>
        ) : undefined
      }
      classeDoCorpo="space-y-4 p-5"
    >
      {consulta.error ? (
        <MensagemErro
          erro={consulta.error}
          titulo="Não foi possível carregar as credenciais"
          aoTentarDeNovo={() => void consulta.refetch()}
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
      )}

      {verificacao && !verificacao.ok && verificacao.mensagem && (
        <Aviso
          tom="erro"
          icone={ShieldAlert}
          titulo={`Renovação do token SSW falhou em ${formatarDataHora(verificacao.em)}`}
        >
          <p className="break-words">{verificacao.mensagem}</p>
          <p className="mt-1">
            Revise as credenciais abaixo e clique em &quot;Testar conexão&quot; para forçar uma nova
            tentativa.
          </p>
        </Aviso>
      )}

      <form className="space-y-4 border-t border-border pt-4" onSubmit={aoSalvar}>
        <div className="grid gap-4 md:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label htmlFor="ssw-senha" className="text-[13px]">
              Senha{" "}
              {dados?.temSenha && (
                <span className="font-normal text-muted-foreground">
                  (deixe vazio para manter a atual)
                </span>
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
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground"
              >
                {mostrarSenha ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Campo
              id="ssw-cnpj"
              rotulo="CNPJ EDI"
              valor={cnpj}
              aoMudar={setCnpj}
              dica={dados?.cnpjEdi || "14 dígitos"}
              numerico
              invalido={!cnpjOk}
            />
            {!cnpjOk && (
              <p id="ssw-cnpj-erro" className="text-xs text-status-bad-fg">
                O CNPJ precisa ter 14 dígitos.
              </p>
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
            <RefreshCw className={cn(testar.isPending && "motion-safe:animate-spin")} aria-hidden />
            {testar.isPending ? "Testando…" : "Testar conexão"}
          </Button>
        </div>
      </form>

      {resultado && !resultado.pendente && (
        <Aviso
          tom={resultado.ok ? "sucesso" : "erro"}
          titulo={
            <>
              {resultado.ok ? "Conexão OK" : "Falha na conexão"}
              {resultado.renovado && " · token renovado"}
              {resultado.tokenPrevia && (
                <span className="ml-1 font-mono font-normal">{resultado.tokenPrevia}</span>
              )}
            </>
          }
        >
          <p className="break-words">{resultado.mensagem}</p>
          {resultado.tipoFalha && <p>{MENSAGEM_DA_FALHA[resultado.tipoFalha]}</p>}
        </Aviso>
      )}
    </Painel>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
  dica,
  numerico = false,
  invalido = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica: string;
  numerico?: boolean;
  invalido?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px]">
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
        aria-invalid={invalido || undefined}
        {...(invalido ? { "aria-describedby": `${id}-erro` } : {})}
        {...(numerico ? { inputMode: "numeric" as const } : {})}
      />
    </div>
  );
}
