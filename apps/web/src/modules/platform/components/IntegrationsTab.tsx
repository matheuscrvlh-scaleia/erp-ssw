import { type IntegracaoDaEmpresa } from "@erp/shared/contracts/platform";

import { CartaoDeIntegracao } from "./IntegrationCard";
import { Carregando } from "./Loading";

export function AbaIntegracoes({
  empresaId,
  integracoes,
  carregando,
  erro,
}: {
  empresaId: string;
  integracoes: readonly IntegracaoDaEmpresa[] | undefined;
  carregando: boolean;
  erro: unknown;
}) {
  return (
    <>
      <Carregando carregando={carregando} erro={erro} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {integracoes?.map((i) => (
          <CartaoDeIntegracao key={i.tipo} empresaId={empresaId} integracao={i} />
        ))}
      </div>
    </>
  );
}
