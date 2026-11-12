import { type LinhaDeComprovante } from "@erp/shared/contratos/comprovantes";
import { formatarInteiro } from "@erp/shared/formatacao";

import { DrawerDetalhe } from "@/componentes/comum/Detalhe";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";

/** A lista lateral do card clicado, paginada no servidor. */
export function ListaDeComprovantes({
  aberto,
  aoFechar,
  titulo,
  descricao,
  colunas,
  linhas,
  total,
  carregando,
  erro,
  aoTentarDeNovo,
  pagina,
  porPagina,
  aoMudarPagina,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao: string;
  colunas: readonly ColunaTabela<LinhaDeComprovante>[];
  linhas: readonly LinhaDeComprovante[];
  total: number;
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  pagina: number;
  porPagina: number;
  aoMudarPagina: (pagina: number) => void;
}) {
  return (
    <DrawerDetalhe
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao={descricao}
      largura="larga"
    >
      <TabelaDados
        colunas={colunas}
        linhas={linhas}
        chaveDaLinha={(l) => l.id}
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={aoTentarDeNovo}
        mensagemVazia="Nenhum CT-e neste recorte."
        paginacaoServidor={{
          pagina,
          porPagina,
          total,
          aoMudarPagina,
        }}
        rotuloTotal={(n) => `${formatarInteiro(n)} CT-e`}
      />
    </DrawerDetalhe>
  );
}
