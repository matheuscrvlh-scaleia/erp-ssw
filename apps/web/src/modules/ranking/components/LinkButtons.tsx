import { type Equipe } from "@erp/shared/contracts/ranking";
import { Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Gerar, copiar ou revogar o link público da equipe. */
export function BotoesDoLink({
  equipe,
  link,
  aoGerar,
  aoCopiar,
  aoRevogar,
}: {
  equipe: Equipe;
  link: string | undefined;
  aoGerar: () => void;
  aoCopiar: (link: string) => void;
  aoRevogar: () => void;
}) {
  if (!equipe.linkAtivo) {
    return (
      <Button size="sm" variant="outline" onClick={aoGerar}>
        <Link2 aria-hidden /> Gerar link público
      </Button>
    );
  }
  return (
    <>
      {link ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            aoCopiar(link);
          }}
        >
          <Copy aria-hidden /> Copiar link
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          title="Por segurança o link só aparece ao ser gerado. Gerar de novo troca o link antigo."
          onClick={aoGerar}
        >
          <Link2 aria-hidden /> Gerar novo link
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-status-bad-fg" onClick={aoRevogar}>
        Revogar
      </Button>
    </>
  );
}
