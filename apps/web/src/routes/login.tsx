import { CAMINHOS_GOOGLE, contratosAuth, ERROS_LOGIN_GOOGLE } from "@erp/shared/contratos/auth";
import { z } from "@erp/shared/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  CartaoDeEntrada,
  CLASSE_CAMPO_DE_ENTRADA,
  ErroDoCampo,
} from "@/acesso/componentes/CartaoDeEntrada";
import { destinoSeguro } from "@/acesso/guarda";
import { entrar } from "@/acesso/sessao";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { chamar, renovarSessao } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

const busca = z.object({
  reason: z.enum(["expired", "signed_out"]).optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
  erro: z.enum(["sem_conta", "falhou"]).optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: busca,
  component: PaginaLogin,
});

type Campos = z.infer<typeof contratosAuth.login.entrada>;

function PaginaLogin() {
  const { reason, redirect, erro } = Route.useSearch();
  const destino = destinoSeguro(redirect);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");
  const [avisoFechado, setAvisoFechado] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const provedores = useQuery({
    queryKey: ["provedores-de-login"],
    queryFn: () => chamar(contratosAuth.provedores),
  });

  useEffect(() => {
    document.title = "Entrar — Painel BI Logístico";
  }, []);

  const irParaODestino = async () => {
    await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    await navigate({ href: destino });
  };

  const restaurarSessao = async () => {
    setRestaurando(true);
    try {
      if (await renovarSessao()) {
        toast.success("Sessão restaurada.");
        await irParaODestino();
        return;
      }
      toast.error("Não foi possível restaurar a sessão. Entre novamente.");
      setAvisoFechado(true);
    } finally {
      setRestaurando(false);
    }
  };

  const aviso = avisoFechado ? null : (
    <>
      {reason === "expired" && (
        <AvisoSessaoExpirada
          restaurando={restaurando}
          aoRestaurar={() => void restaurarSessao()}
          aoFechar={() => {
            setAvisoFechado(true);
          }}
        />
      )}
      {reason === "signed_out" && (
        <div className="mb-4 rounded-lg border border-border bg-muted p-3 text-[13px] text-muted-foreground">
          Você saiu da conta. Entre novamente para continuar.
        </div>
      )}
      {erro && (
        <div className="mb-4 rounded-lg border border-status-bad/40 bg-status-bad-bg p-3 text-[13px] text-status-bad-fg">
          {ERROS_LOGIN_GOOGLE[erro]}
        </div>
      )}
    </>
  );

  if (modo === "esqueci") {
    return (
      <CartaoDeEntrada
        titulo="Esqueci a senha"
        subtitulo="Enviamos um link para você criar uma senha nova."
      >
        <FormularioEsqueci
          aoVoltar={() => {
            setModo("entrar");
          }}
        />
      </CartaoDeEntrada>
    );
  }

  return (
    <CartaoDeEntrada
      titulo="Entre com sua conta"
      subtitulo="Performance logística em tempo real."
      aviso={aviso}
      rodape="Sem conta? Peça um convite ao administrador da sua empresa."
    >
      <FormularioEntrar
        aoEntrar={irParaODestino}
        aoEsquecer={() => {
          setModo("esqueci");
        }}
      />
      {provedores.data?.google && (
        <>
          <div className="my-5 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              // O navegador sai daqui: a API leva ao Google e volta já com o cookie de sessão.
              window.location.assign(
                `${CAMINHOS_GOOGLE.iniciar}?redirect=${encodeURIComponent(destino)}`,
              );
            }}
          >
            Continuar com Google
          </Button>
        </>
      )}
    </CartaoDeEntrada>
  );
}

function FormularioEntrar({
  aoEntrar,
  aoEsquecer,
}: {
  aoEntrar: () => Promise<void>;
  aoEsquecer: () => void;
}) {
  const formulario = useForm<Campos>({
    resolver: zodResolver(contratosAuth.login.entrada),
    defaultValues: { email: "", senha: "" },
  });
  const { errors, isSubmitting } = formulario.formState;
  const enviar = formulario.handleSubmit(async ({ email, senha }) => {
    try {
      await entrar(email, senha);
      await aoEntrar();
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível entrar."));
    }
  });

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="email" className="mb-2 block text-[13px] text-muted-foreground">
          E-mail
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className={CLASSE_CAMPO_DE_ENTRADA}
          {...formulario.register("email")}
        />
        <ErroDoCampo mensagem={errors.email?.message} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label htmlFor="senha" className="text-[13px] text-muted-foreground">
            Senha
          </Label>
          <button
            type="button"
            onClick={aoEsquecer}
            className="text-[12.5px] font-medium text-brand hover:underline"
          >
            Esqueci a senha
          </button>
        </div>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          className={CLASSE_CAMPO_DE_ENTRADA}
          {...formulario.register("senha")}
        />
        <ErroDoCampo mensagem={errors.senha?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-[14px]">
        {isSubmitting ? "Aguarde..." : "Entrar"}
      </Button>
    </form>
  );
}

function FormularioEsqueci({ aoVoltar }: { aoVoltar: () => void }) {
  const [enviado, setEnviado] = useState<string | null>(null);
  const formulario = useForm<z.infer<typeof contratosAuth.esqueciSenha.entrada>>({
    resolver: zodResolver(contratosAuth.esqueciSenha.entrada),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = formulario.formState;
  const enviar = formulario.handleSubmit(async (entrada) => {
    try {
      // A resposta é a mesma exista ou não a conta (ninguém descobre e-mail cadastrado aqui).
      setEnviado((await chamar(contratosAuth.esqueciSenha, { entrada })).mensagem);
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível enviar o link."));
    }
  });

  return (
    <div className="space-y-3">
      {enviado ? (
        <p className="rounded-lg border border-border bg-muted p-3 text-[13px] text-muted-foreground">
          {enviado}
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="email" className="mb-2 block text-[13px] text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className={CLASSE_CAMPO_DE_ENTRADA}
              {...formulario.register("email")}
            />
            <ErroDoCampo mensagem={errors.email?.message} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-[14px]">
            {isSubmitting ? "Aguarde..." : "Enviar link"}
          </Button>
        </form>
      )}
      <Button type="button" variant="ghost" className="h-11 w-full" onClick={aoVoltar}>
        Voltar para o login
      </Button>
    </div>
  );
}

function AvisoSessaoExpirada({
  restaurando,
  aoRestaurar,
  aoFechar,
}: {
  restaurando: boolean;
  aoRestaurar: () => void;
  aoFechar: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-status-warn/40 bg-status-warn-bg p-3 text-[13px] text-status-warn-fg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <div className="font-medium">Sua sessão expirou</div>
          <p className="mt-0.5 text-[12px] opacity-90">
            Podemos tentar restaurar automaticamente antes de pedir suas credenciais.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={aoRestaurar}
              disabled={restaurando}
              className="h-8 gap-1.5 text-[12px]"
            >
              <RefreshCw className={`h-3 w-3 ${restaurando ? "animate-spin" : ""}`} />
              {restaurando ? "Restaurando…" : "Tentar restaurar sessão"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={aoFechar}
              className="h-8 text-[12px]"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
