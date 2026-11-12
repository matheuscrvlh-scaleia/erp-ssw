import {
  type Acao,
  ACOES,
  ACOES_DA_TELA,
  type CategoriaDeTela,
  CATEGORIAS_DE_TELA,
  type Permissao,
  ROTULO_DA_ACAO,
} from "@erp/shared/acesso/permissoes";
import { ROTULO_DA_TELA, type Tela } from "@erp/shared/acesso/telas";
import { type ReactNode } from "react";

import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { Checkbox } from "@/componentes/ui/checkbox";

import { alternarAcao, temAcao } from "../permissoes";

/**
 * Tabela de permissões por categoria: linhas = telas, colunas = Ver / Criar-Editar / Excluir. A
 * célula de cada ação vem de `celula`; ação que a tela não tem mostra "—".
 */
export function TabelaDePermissoes({
  celula,
  larguraDaCelula = "w-32",
  categorias = CATEGORIAS_DE_TELA,
}: {
  celula: (tela: Tela, acao: Acao) => ReactNode;
  larguraDaCelula?: string;
  /** Telas do editor (padrão: as da empresa; a Plataforma passa as dela). */
  categorias?: readonly CategoriaDeTela[];
}) {
  return (
    <div className="min-w-0 space-y-3">
      {categorias.map((c) => (
        <div key={c.chave} className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className={CLASSE_TABELA}>
            <thead className={CLASSE_CABECALHO}>
              <tr>
                <th className={CLASSE_TH}>
                  {c.rotulo}
                  <span className="mt-0.5 block text-xs font-normal tracking-normal normal-case">
                    {c.descricao}
                  </span>
                </th>
                {ACOES.map((a) => (
                  <th key={a} className={`${CLASSE_TH} ${larguraDaCelula} text-center`}>
                    {ROTULO_DA_ACAO[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.telas.map((t) => (
                <tr key={t} className={CLASSE_LINHA}>
                  <td className={CLASSE_TD}>{ROTULO_DA_TELA[t]}</td>
                  {ACOES.map((a) => (
                    <td key={a} className={`${CLASSE_TD} text-center`}>
                      {ACOES_DA_TELA[t].includes(a) ? (
                        celula(t, a)
                      ) : (
                        <span className="text-muted-foreground" title="Tela só de leitura">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

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
