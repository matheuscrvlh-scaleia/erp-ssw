import { type EmpresaCompleta, type IntegracaoDaEmpresa } from "@erp/shared/contracts/platform";

import { CartaoDeIntegracao } from "./IntegrationCard";
import { Carregando } from "./Loading";
import { CartaoDoDominioSsw } from "./SswDomainCard";

export function AbaIntegracoes({
  empresa,
  integracoes,
  carregando,
  erro,
}: {
  empresa: EmpresaCompleta;
  integracoes: readonly IntegracaoDaEmpresa[] | undefined;
  carregando: boolean;
  erro: unknown;
}) {
  return (
    <div className="space-y-4">
      <CartaoDoDominioSsw empresa={empresa} />
      <Carregando carregando={carregando} erro={erro} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {integracoes?.map((i) => (
          <CartaoDeIntegracao key={i.tipo} empresaId={empresa.id} integracao={i} />
        ))}
      </div>
    </div>
  );
}
