import { type CategoriaDeTela, type Permissao } from "@erp/shared/acesso/permissoes";
import { type Cargo } from "@erp/shared/contratos/admin";
import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import { type ReactNode } from "react";

import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";

import { ModalDeCargo } from "./componentes/ModalDeCargo";
import { resumoDoCargo } from "./textos";

export interface DadosDoCargo {
  chave: string;
  rotulo: string;
  permissoes: Permissao[];
}

interface Gravacao<E> {
  gravar: (entrada: E) => Promise<boolean>;
  gravando: boolean;
}

export interface GravacoesDeCargo {
  criar: Gravacao<DadosDoCargo>;
  alterar: Gravacao<DadosDoCargo>;
  excluir: Gravacao<string>;
}

/**
 * De quem são os cargos: as telas do editor, o aviso do cargo que tem tudo e as gravações (os
 * cargos da empresa ou os da equipe da Plataforma).
 */
export interface CatalogoDeCargos {
  categorias: readonly CategoriaDeTela[];
  avisoTemTudo: string;
  gravacoes: GravacoesDeCargo;
}

/** Aba Cargos: a lista com o editor de permissões de cada cargo. */
export function useAbaCargos({
  cargos,
  carregando,
  erro,
  aoTentarDeNovo,
  podeEditar,
  podeExcluir,
  catalogo,
}: {
  cargos: readonly Cargo[];
  carregando: boolean;
  erro: unknown;
  aoTentarDeNovo: () => void;
  podeEditar: boolean;
  podeExcluir: boolean;
  catalogo: CatalogoDeCargos;
}): { acoes: ReactNode; conteudo: ReactNode } {
  const { criar, alterar, excluir } = catalogo.gravacoes;

  const apagar = (cargo: Cargo) => {
    const confirmou = window.confirm(
      `Apagar o cargo "${cargo.rotulo}"? Esta ação não pode ser desfeita. As permissões dele serão removidas.`,
    );
    if (confirmou) void excluir.gravar(cargo.chave);
  };

  const colunas: ColunaTabela<Cargo>[] = [
    {
      chave: "rotulo",
      titulo: "Cargo",
      celula: (cargo) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{cargo.rotulo}</span>
          {cargo.temTudo && (
            <SeloStatus tom="info" icone={ShieldCheck}>
              Acesso total
            </SeloStatus>
          )}
          {cargo.protegido && (
            <SeloStatus tom="neutro" icone={Lock}>
              Protegido
            </SeloStatus>
          )}
        </div>
      ),
    },
    { chave: "chave", titulo: "Chave", classe: "font-mono text-xs text-muted-foreground" },
    {
      chave: "permissoes",
      titulo: "Telas",
      classe: "text-muted-foreground",
      valor: (cargo) => resumoDoCargo(cargo, catalogo.categorias),
    },
    { chave: "usuarios", titulo: "Usuários", formato: "inteiro", classe: "text-muted-foreground" },
    {
      chave: "acoes",
      titulo: "",
      ordenavel: false,
      semExportar: true,
      alinhamento: "direita",
      celula: (cargo) => (
        <div className="flex justify-end gap-1">
          <ModalDeCargo
            cargo={cargo}
            podeEditar={podeEditar}
            aoGravar={alterar.gravar}
            catalogo={catalogo}
          />
          {podeExcluir && !cargo.protegido && !cargo.temTudo && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-status-bad-fg hover:text-status-bad-fg"
              disabled={excluir.gravando || cargo.usuarios > 0}
              aria-label={`Apagar ${cargo.rotulo}`}
              title={
                cargo.usuarios > 0
                  ? `Em uso por ${String(cargo.usuarios)} usuário(s)`
                  : "Apagar cargo"
              }
              onClick={() => {
                apagar(cargo);
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return {
    acoes: podeEditar && (
      <ModalDeCargo cargo={null} podeEditar aoGravar={criar.gravar} catalogo={catalogo} />
    ),
    conteudo: (
      <TabelaDados
        colunas={colunas}
        linhas={cargos}
        chaveDaLinha={(cargo) => cargo.chave}
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={aoTentarDeNovo}
        mensagemVazia="Nenhum cargo cadastrado. Crie o primeiro em “Novo cargo”."
      />
    ),
  };
}
