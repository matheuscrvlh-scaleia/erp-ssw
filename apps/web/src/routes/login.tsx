import { contratosAuth } from "@erp/shared/contratos/auth";
import { z } from "@erp/shared/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

/** Só o destino: no login não aparece aviso nenhum além de e-mail ou senha errados. */
const busca = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: busca,
  component: PaginaLogin,
});

type Campos = z.infer<typeof contratosAuth.login.entrada>;

function PaginaLogin() {
  const { redirect } = Route.useSearch();
  const destino = destinoSeguro(redirect);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");

  useEffect(() => {
    document.title = "Entrar — Painel BI Logístico";
  }, []);

  const irParaODestino = async () => {
    await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    await navigate({ href: destino });
  };

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
      rodape="Sem conta? Peça um convite ao administrador da sua empresa."
    >
      <FormularioEntrar
        aoEntrar={irParaODestino}
        aoEsquecer={() => {
          setModo("esqueci");
        }}
      />
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
