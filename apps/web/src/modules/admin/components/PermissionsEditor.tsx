import {
  type CategoriaDeTela,
  type Permissao,
  ROTULO_DA_ACAO,
} from "@erp/shared/access/permissions";
import { ROTULO_DA_TELA } from "@erp/shared/access/screens";

import { Checkbox } from "@/components/ui/checkbox";

import { alternarAcao, temAcao } from "../rules";
import { TabelaDePermissoes } from "./PermissionsTable";

/** Editor do cargo: marca as ações de cada tela (Admin e Super Admin: tudo, sem editar). */
export function EditorDePermissoes({
  permissoes,
  aoMudar,
  categorias,
  somenteLeitura = false,
}: {
  permissoes: ReadonlySet<Permissao>;
  aoMudar: (permissoes: Set<Permissao>) => void;
  categorias: readonly CategoriaDeTela[];
  somenteLeitura?: boolean;
}) {
  return (
    <TabelaDePermissoes
      categorias={categorias}
      celula={(tela, acao) => (
        <Checkbox
          aria-label={`${ROTULO_DA_TELA[tela]}: ${ROTULO_DA_ACAO[acao]}`}
          checked={temAcao(permissoes, tela, acao)}
          disabled={somenteLeitura}
          onCheckedChange={(v) => {
            aoMudar(alternarAcao(permissoes, tela, acao, v === true));
          }}
        />
      )}
    />
  );
}
