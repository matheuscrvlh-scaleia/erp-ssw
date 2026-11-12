import { sql, type Transacao } from "@erp/db";

import { type RepositorioAhgora } from "./ahgora.service";

export function criarRepositorioAhgora(tx: Transacao): RepositorioAhgora {
  return {
    integracao: async (empresaId) => {
      const [linha] = await tx.consultar<{
        empresaNome: string;
        empresaStatus: string;
        ativo: boolean | null;
        parametros: Record<string, unknown> | null;
        segredoCifrado: string | null;
        segredoVersaoChave: number | null;
      }>(sql`
        select e.nome as "empresaNome", e.status as "empresaStatus", i.ativo, i.parametros,
               i.segredo_cifrado as "segredoCifrado", i.segredo_versao_chave as "segredoVersaoChave"
        from erp.empresas e
        left join erp.empresa_integracoes i on i.empresa_id = e.id and i.tipo = 'ahgora'
        where e.id = ${empresaId}`);
      if (!linha) return null;
      return {
        empresaNome: linha.empresaNome,
        empresaStatus: linha.empresaStatus,
        ativo: linha.ativo,
        parametros: linha.parametros ?? {},
        segredo:
          linha.segredoCifrado !== null && linha.segredoVersaoChave !== null
            ? { cifrado: linha.segredoCifrado, versaoChave: linha.segredoVersaoChave }
            : null,
      };
    },
  };
}
