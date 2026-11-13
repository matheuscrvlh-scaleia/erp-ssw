import { sql, type Transacao } from "@erp/db";
import { TIPOS_INTEGRACAO_PLATAFORMA } from "@erp/shared/platform";

import { type RepositorioSegredos } from "./secrets.service";

const segredoDe = (cifrado: string | null, versaoChave: number | null) =>
  cifrado === null || versaoChave === null ? null : { cifrado, versaoChave };

interface LinhaDeSegredo {
  cifrado: string | null;
  versaoChave: number | null;
}

/** Precisa de contexto de Plataforma: o RLS só deixa a Plataforma alterar integrações. */
export function criarRepositorioSegredos(tx: Transacao): RepositorioSegredos {
  return {
    foraDaVersao: async (versao) => {
      const linhas = await tx.consultar<
        LinhaDeSegredo & {
          id: string;
          empresaId: string;
          tipo: string;
          anteriorCifrado: string | null;
          anteriorVersaoChave: number | null;
        }
      >(sql`
        select id, empresa_id as "empresaId", tipo, segredo_cifrado as cifrado,
               segredo_versao_chave as "versaoChave",
               segredo_anterior_cifrado as "anteriorCifrado",
               segredo_anterior_versao_chave as "anteriorVersaoChave"
        from erp.empresa_integracoes
        where segredo_versao_chave <> ${versao} or segredo_anterior_versao_chave <> ${versao}`);
      const daPlataforma = await tx.consultar<LinhaDeSegredo & { tipo: string }>(sql`
        select tipo, segredo_cifrado as cifrado, segredo_versao_chave as "versaoChave"
        from erp.plataforma_integracoes
        where segredo_versao_chave <> ${versao}`);
      return [
        ...linhas.map((l) => ({
          id: l.id,
          empresaId: l.empresaId,
          tipo: l.tipo,
          segredo: segredoDe(l.cifrado, l.versaoChave),
          segredoAnterior: segredoDe(l.anteriorCifrado, l.anteriorVersaoChave),
        })),
        ...daPlataforma.map((l) => ({
          id: l.tipo,
          empresaId: null,
          tipo: l.tipo,
          segredo: segredoDe(l.cifrado, l.versaoChave),
          segredoAnterior: null,
        })),
      ];
    },

    regravar: async (linha, { segredo, segredoAnterior }) => {
      if (linha.empresaId === null) {
        const tipo = TIPOS_INTEGRACAO_PLATAFORMA.find((t) => t === linha.tipo);
        if (!tipo) throw new Error(`Tipo de integração da Plataforma desconhecido: ${linha.tipo}`);
        await tx.executar(sql`
          update erp.plataforma_integracoes
          set segredo_cifrado = ${segredo?.cifrado ?? null},
              segredo_versao_chave = ${segredo?.versaoChave ?? null}
          where tipo = ${tipo}`);
        return;
      }
      await tx.executar(sql`
        update erp.empresa_integracoes
        set segredo_cifrado = ${segredo?.cifrado ?? null},
            segredo_versao_chave = ${segredo?.versaoChave ?? null},
            segredo_anterior_cifrado = ${segredoAnterior?.cifrado ?? null},
            segredo_anterior_versao_chave = ${segredoAnterior?.versaoChave ?? null}
        where id = ${linha.id}`);
    },
  };
}
