import { contratosAuth } from "@erp/shared/contratos/auth";
import { z } from "@erp/shared/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";

import { ErroDoCampo } from "./CartaoDeEntrada";

const esquema = z
  .object({
    nome: z.string().trim().max(120),
    senha: contratosAuth.redefinirSenha.entrada.shape.senha,
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não conferem.",
  });

type Campos = z.infer<typeof esquema>;

export interface NovaSenha {
  senha: string;
  nome?: string;
}

/** Senha nova com confirmação (redefinição e convite). O convite também pede o nome. */
export function FormularioNovaSenha({
  pedirNome,
  rotuloDoBotao,
  aoEnviar,
}: {
  pedirNome: boolean;
  rotuloDoBotao: string;
  aoEnviar: (dados: NovaSenha) => Promise<void>;
}) {
  const formulario = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: "", senha: "", confirmacao: "" },
  });
  const { errors, isSubmitting } = formulario.formState;
  const enviar = formulario.handleSubmit(async ({ nome, senha }) => {
    await aoEnviar(pedirNome && nome ? { senha, nome } : { senha });
  });

  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      {pedirNome && (
        <div>
          <Label htmlFor="nome">Seu nome</Label>
          <Input id="nome" autoComplete="name" {...formulario.register("nome")} />
          <ErroDoCampo mensagem={errors.nome?.message} />
        </div>
      )}
      <div>
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="new-password"
          {...formulario.register("senha")}
        />
        <ErroDoCampo mensagem={errors.senha?.message} />
      </div>
      <div>
        <Label htmlFor="confirmacao">Repita a senha</Label>
        <Input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          {...formulario.register("confirmacao")}
        />
        <ErroDoCampo mensagem={errors.confirmacao?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Aguarde..." : rotuloDoBotao}
      </Button>
    </form>
  );
}
