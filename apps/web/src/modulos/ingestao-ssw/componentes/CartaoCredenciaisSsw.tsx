import { formatarDataHora } from "@erp/shared/formatacao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, PowerOff, RefreshCw, ShieldAlert } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";

import { Aviso } from "@/componentes/comum/Aviso";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import { consultaCredenciais, mutacaoSalvarCredenciais, mutacaoTestarConexao } from "../api";
import { CampoDaCredencial } from "./CampoDaCredencial";
import { ResultadoDoTesteSsw } from "./ResultadoDoTesteSsw";
import { SituacaoDasCredenciais } from "./SituacaoDasCredenciais";

/**
 * Credenciais da SSW API (a senha nunca volta para a tela) e "Testar conexão", que roda o
 * heartbeat do token agora. Usado pelas duas telas (Ingestão e Diagnóstico): carrega e grava
 * pelas consultas e mutações do api.ts.
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

  const salvar = useMutation({
    ...mutacaoSalvarCredenciais(queryClient, (r) => {
      toast.success(
        r.tokenInvalidado
          ? "Credenciais salvas. O token antigo foi descartado; teste a conexão."
          : "Credenciais salvas.",
      );
      setDominio("");
      setUsuario("");
      setSenha("");
      setCnpj("");
    }),
    onError: (e) =>
      toast.error("Não foi possível salvar as credenciais", { description: mensagemAmigavel(e) }),
  });

  const testar = useMutation({
    ...mutacaoTestarConexao(queryClient, (r) => {
      if (r.pendente) toast.info(r.mensagem);
      else if (r.ok) toast.success(r.renovado ? "Conexão OK · token renovado" : "Conexão OK");
      else toast.error("Falha na conexão com a SSW", { description: r.mensagem });
    }),
    onError: (e) =>
      toast.error("Não foi possível testar a conexão", { description: mensagemAmigavel(e) }),
  });

  const aoSalvar = (e: SyntheticEvent) => {
    e.preventDefault();
    if (preenchido && cnpjOk)
      salvar.mutate({
        ...(dominio.trim() ? { dominio: dominio.trim() } : {}),
        ...(usuario.trim() ? { usuario: usuario.trim() } : {}),
        ...(senha ? { senha } : {}),
        ...(cnpjDigitos ? { cnpjEdi: cnpjDigitos } : {}),
      });
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
      <SituacaoDasCredenciais
        dados={dados}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
      />

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
          <CampoDaCredencial
            id="ssw-dominio"
            rotulo="Domínio"
            valor={dominio}
            aoMudar={setDominio}
            dica={dados?.dominio || "ex.: FRT"}
          />
          <CampoDaCredencial
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
            <CampoDaCredencial
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

      {resultado && !resultado.pendente && <ResultadoDoTesteSsw resultado={resultado} />}
    </Painel>
  );
}
