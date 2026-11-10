import { type MotivoDaSaude } from "@erp/shared/contratos/ingestao-ssw";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { consultaSaudeSsw } from "./api";

const DETALHE: Record<Exclude<MotivoDaSaude, "ok">, string> = {
  sem_credenciais: "credenciais não configuradas",
  sem_token: "nenhum token gerado ainda",
  token_expirado: "token expirado",
};

/**
 * Faixa do layout quando a SSW API da empresa ativa está ligada e sem token válido. O link leva
 * à configuração (a tela só abre para quem tem acesso; os demais caem na primeira tela deles).
 * origem: features/ssw/components/SswHealthBanner.tsx (sistema atual)
 */
export function FaixaSaudeSsw({ empresaId }: { empresaId: string }) {
  const { data } = useQuery(consultaSaudeSsw(empresaId));
  if (!data || data.saudavel || data.motivo === "ok") return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-900 dark:text-amber-100"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
        aria-hidden
      />
      <div className="flex-1">
        <p className="font-medium">Integração SSW indisponível — {DETALHE[data.motivo]}.</p>
        <p className="text-amber-900/80 dark:text-amber-100/80">
          Os dados exibidos podem estar desatualizados até que a conexão seja restabelecida.
        </p>
      </div>
      <Link
        to="/admin/ingestao"
        className="shrink-0 rounded border border-amber-600/50 px-2 py-1 text-xs font-medium hover:bg-amber-500/20"
      >
        Abrir configuração
      </Link>
    </div>
  );
}
