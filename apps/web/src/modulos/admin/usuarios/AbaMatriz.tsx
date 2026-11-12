import { type Permissao } from "@erp/shared/acesso/permissoes";
import { ROTULO_DA_TELA, type Tela } from "@erp/shared/acesso/telas";
import { type Cargo } from "@erp/shared/contratos/admin";
import { Fragment } from "react";

import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { LinhasCarregando } from "@/componentes/comum/LinhasCarregando";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Checkbox } from "@/componentes/ui/checkbox";

import { alternarNaMatriz, marcadoNaMatriz } from "../permissoes";
import { type CatalogoDeCargos } from "./AbaCargos";

/**
 * Matriz de permissões: linhas = telas, colunas = cargos. A célula liga Ver e Criar/Editar;
 * Excluir só no editor do cargo, para um clique aqui nunca liberar exclusão.
 * origem: PermissionMatrixDialog (construgarden)
 */
export function MatrizDePermissoes({
  cargos,
  carregando,
  erro,
  aoTentarDeNovo,
  podeEditar,
  catalogo,
}: {
  cargos: readonly Cargo[];
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  podeEditar: boolean;
  catalogo: CatalogoDeCargos;
}) {
  const { alterar } = catalogo.gravacoes;

  const alternar = (cargo: Cargo, tela: Tela, ligar: boolean) => {
    const permissoes: Permissao[] = [...alternarNaMatriz(new Set(cargo.permissoes), tela, ligar)];
    void alterar.gravar({ chave: cargo.chave, rotulo: cargo.rotulo, permissoes });
  };

  if (erro) return <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />;

  return (
    <Painel
      titulo="Matriz de permissões"
      descricao="Marcar libera Ver e Criar/Editar; desmarcar tira a tela do cargo. Excluir só no editor do cargo (aba Cargos)."
      classeDoCorpo="overflow-x-auto"
    >
      {carregando ? (
        <table className={CLASSE_TABELA}>
          <tbody>
            <LinhasCarregando linhas={8} colunas={5} />
          </tbody>
        </table>
      ) : cargos.length === 0 ? (
        <EstadoVazio mensagem="Nenhum cargo." detalhe="Crie um cargo na aba Cargos." />
      ) : (
        <table className={CLASSE_TABELA}>
          <thead className={CLASSE_CABECALHO}>
            <tr>
              <th className={CLASSE_TH}>Tela</th>
              {cargos.map((c) => (
                <th key={c.chave} className={`${CLASSE_TH} text-center`}>
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalogo.categorias.map((categoria) => (
              <Fragment key={categoria.chave}>
                <tr className="border-b border-border bg-muted/40">
                  <td colSpan={cargos.length + 1} className={`${CLASSE_TD} label-xs`}>
                    {categoria.rotulo}
                  </td>
                </tr>
                {categoria.telas.map((tela) => (
                  <tr key={tela} className={CLASSE_LINHA}>
                    <td className={CLASSE_TD}>{ROTULO_DA_TELA[tela]}</td>
                    {cargos.map((c) => (
                      <td key={c.chave} className={`${CLASSE_TD} text-center`}>
                        <Checkbox
                          aria-label={`${c.rotulo}: ${ROTULO_DA_TELA[tela]}`}
                          title={c.temTudo ? "Este cargo tem tudo" : undefined}
                          checked={c.temTudo || marcadoNaMatriz(new Set(c.permissoes), tela)}
                          disabled={c.temTudo || !podeEditar || alterar.gravando}
                          onCheckedChange={(v) => {
                            alternar(c, tela, v === true);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </Painel>
  );
}
