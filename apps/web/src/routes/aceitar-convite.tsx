import { contratosAuth } from "@erp/shared/contracts/auth";
import { z } from "@erp/shared/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { CartaoDeEntrada } from "@/access/components/LoginCard";
import { FormularioNovaSenha, type NovaSenha } from "@/access/components/NewPasswordForm";
import { chamar } from "@/lib/api";
import { mensagemAmigavel } from "@/lib/error-message";

export const Route = createFileRoute("/aceitar-convite")({
  validateSearch: z.object({ token: z.string().catch("") }),
  component: PaginaAceitarConvite,
});

/** O convite só vale com senha definida aqui (decisão Q33 do dono). */
function PaginaAceitarConvite() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const aceitar = async (dados: NovaSenha) => {
    try {
      await chamar(contratosAuth.aceitarConvite, { entrada: { token, ...dados } });
      toast.success("Conta pronta. Entre com seu e-mail e a senha que você criou.");
      await navigate({ to: "/login" });
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível aceitar o convite."));
    }
  };

  return (
    <CartaoDeEntrada titulo="Aceite o convite" subtitulo="Crie a senha para entrar no painel.">
      <FormularioNovaSenha pedirNome rotuloDoBotao="Criar conta" aoEnviar={aceitar} />
    </CartaoDeEntrada>
  );
}
