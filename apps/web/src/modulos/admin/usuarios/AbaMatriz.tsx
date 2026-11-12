import { type Permissao } from "@erp/shared/acesso/permissoes";
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

import {
  alternarAcao,
  faltaATela,
  type LinhaDaMatriz,
  linhasDaTela,
  type Matriz,
  temAcao,
} from "../permissoes";
import { type CatalogoDeCargos } from "./AbaCargos";

const TEXTOS: Record<Matriz, { titulo: string; coluna: string; descricao: string }> = {
  acessos: {
    titulo: "Matriz de acessos",
    coluna: "Tela",
    descricao:
      "Cada linha é uma tela: marcada, ela aparece no menu e abre para o cargo. Desmarcar tira também as permissões da tela. O que se faz dentro dela fica na Matriz de permissões.",
  },
  permissoes: {
    titulo: "Matriz de permissões",
    coluna: "Evento",
    descricao:
      "Cada linha libera um evento dentro de uma tela. A tela precisa estar liberada na Matriz de acessos.",
  },
};

/**
 * As duas matrizes dos cargos: linhas = telas (acessos) ou eventos (permissões), colunas = cargos.
 * Cada célula liga e desliga só a sua linha; evento de tela que o cargo não abre fica travado.
 * origem: PermissionMatrix (construgarden, src/pages/construgarden/Configuracoes.tsx)
 */
export function MatrizDeCargos({
  matriz,
  cargos,
  carregando,
  erro,
  aoTentarDeNovo,
  podeEditar,
  catalogo,
}: {
  matriz: Matriz;
  cargos: readonly Cargo[];
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  podeEditar: boolean;
  catalogo: CatalogoDeCargos;
}) {
  const { alterar } = catalogo.gravacoes;
  const textos = TEXTOS[matriz];
  const categorias = catalogo.categorias
    .map((c) => ({ ...c, linhas: c.telas.flatMap((tela) => linhasDaTela(matriz, tela)) }))
    .filter((c) => c.linhas.length > 0);
  const colunas = cargos.map((cargo) => ({ cargo, conjunto: new Set(cargo.permissoes) }));

  const alternar = (
    cargo: Cargo,
    conjunto: ReadonlySet<Permissao>,
    linha: LinhaDaMatriz,
    ligar: boolean,
  ) => {
    const permissoes = [...alternarAcao(conjunto, linha.tela, linha.acao, ligar)];
    void alterar.gravar({ chave: cargo.chave, rotulo: cargo.rotulo, permissoes });
  };

  if (erro) return <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />;

  return (
    <Painel titulo={textos.titulo} descricao={textos.descricao} classeDoCorpo="overflow-x-auto">
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
              <th className={CLASSE_TH}>{textos.coluna}</th>
              {cargos.map((c) => (
                <th key={c.chave} className={`${CLASSE_TH} w-36 text-center`}>
                  <span className="block">{c.rotulo}</span>
                  {c.temTudo && (
                    <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                      acesso total
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <Fragment key={categoria.chave}>
                <tr className="border-b border-border bg-muted/40">
                  <td colSpan={cargos.length + 1} className={`${CLASSE_TD} label-xs`}>
                    {categoria.rotulo}
                  </td>
                </tr>
                {categoria.linhas.map((linha) => (
                  <tr key={`${linha.tela}.${linha.acao}`} className={CLASSE_LINHA}>
                    <td className={CLASSE_TD}>{linha.rotulo}</td>
                    {colunas.map(({ cargo, conjunto }) => {
                      const semTela = !cargo.temTudo && faltaATela(conjunto, linha);
                      return (
                        <td key={cargo.chave} className={`${CLASSE_TD} w-36`}>
                          <div className="flex justify-center">
                            <Checkbox
                              aria-label={`${cargo.rotulo}: ${linha.rotulo}`}
                              title={
                                cargo.temTudo
                                  ? "Este cargo tem tudo"
                                  : semTela
                                    ? "Libere a tela na Matriz de acessos"
                                    : undefined
                              }
                              checked={
                                cargo.temTudo ||
                                (!semTela && temAcao(conjunto, linha.tela, linha.acao))
                              }
                              disabled={cargo.temTudo || semTela || !podeEditar || alterar.gravando}
                              onCheckedChange={(v) => {
                                alternar(cargo, conjunto, linha, v === true);
                              }}
                            />
                          </div>
                        </td>
                      );
                    })}
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
