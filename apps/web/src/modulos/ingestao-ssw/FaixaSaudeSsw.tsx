import { type MotivoDaSaude } from "@erp/shared/contratos/ingestao-ssw";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Aviso } from "@/componentes/comum/Aviso";
import { Button } from "@/componentes/ui/button";

import { consultaSaudeSsw } from "./api";

const DETALHE: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "credenciais não configuradas",
  sem_token: "nenhum token gerado ainda",
  token_expirado: "token expirado",
};

/**
 * Notificação do layout quando a SSW API da empresa ativa está ligada e sem token válido. O link leva
 * à configuração (a tela só abre para quem tem acesso; os demais caem na primeira tela deles).
 * origem: features/ssw/components/SswHealthBanner.tsx (sistema atual)
 */
export function FaixaSaudeSsw({ empresaId }: { empresaId: string }) {
  const { data } = useQuery(consultaSaudeSsw(empresaId));
  if (!data || data.saudavel || data.motivo === "ok") return null;

  return (
    <Aviso
      tom="alerta"
      titulo={`Integração SSW indisponível — ${DETALHE[data.motivo]}.`}
      acao={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/ingestao">Abrir configuração</Link>
        </Button>
      }
    >
      Os dados exibidos podem estar desatualizados até que a conexão seja restabelecida.
    </Aviso>
  );
}
