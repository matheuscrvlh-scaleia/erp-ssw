import { contratosAuth } from "@erp/shared/contratos/auth";
import { z } from "@erp/shared/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { CartaoDeEntrada } from "@/acesso/componentes/CartaoDeEntrada";
import { FormularioNovaSenha, type NovaSenha } from "@/acesso/componentes/FormularioNovaSenha";
import { chamar } from "@/lib/api";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: z.object({ token: z.string().catch("") }),
  component: PaginaRedefinirSenha,
});

function PaginaRedefinirSenha() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const redefinir = async ({ senha }: NovaSenha) => {
    try {
      await chamar(contratosAuth.redefinirSenha, { entrada: { token, senha } });
      toast.success("Senha alterada. Entre com a senha nova.");
      await navigate({ to: "/login" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    }
  };

  return (
    <CartaoDeEntrada titulo="Crie uma senha nova" subtitulo="O link vale por 1 hora.">
      <FormularioNovaSenha pedirNome={false} rotuloDoBotao="Salvar senha" aoEnviar={redefinir} />
    </CartaoDeEntrada>
  );
}
