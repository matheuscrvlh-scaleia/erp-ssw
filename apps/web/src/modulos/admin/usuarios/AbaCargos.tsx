import {
  type CategoriaDeTela,
  CATEGORIAS_DE_TELA,
  type Permissao,
  telasComVer,
} from "@erp/shared/acesso/permissoes";
import { type Cargo, contratosAdmin as c } from "@erp/shared/contratos/admin";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CAMPO, Campo } from "@/componentes/comum/CamposDeFormulario";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { useGravacao } from "@/hooks/use-gravacao";
import { chamar } from "@/lib/api";

import { CHAVES } from "../api";
import { EditorDePermissoes } from "./EditorDePermissoes";

/** Chave sugerida pelo nome: minúsculas, sem acento, `_` no lugar do resto. */
export function chaveDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/** "8 de 18 telas" das categorias do editor (cargo com tudo: "Todas"). */
export function resumoDoCargo(
  cargo: Pick<Cargo, "temTudo" | "permissoes">,
  categorias: readonly CategoriaDeTela[] = CATEGORIAS_DE_TELA,
): string {
  if (cargo.temTudo) return "Todas";
  const doEditor = categorias.flatMap((c) => c.telas);
  const telas = telasComVer(cargo.permissoes).filter((t) => doEditor.includes(t));
  return `${String(telas.length)} de ${String(doEditor.length)} telas`;
}

export interface DadosDoCargo {
  chave: string;
  rotulo: string;
  permissoes: Permissao[];
}

/** Mudar permissões de um cargo muda o acesso de quem o usa (inclusive o de quem edita). */
export const INVALIDAR_CARGOS = [CHAVES.cargos, CHAVES.usuarios, CHAVES.acesso];

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

export const AVISO_TEM_TUDO_DA_EMPRESA =
  "Admin e Super Admin têm todas as permissões e não podem ser restringidos. Para tirar algo de uma pessoa, marque “Não” nas permissões dela.";

export function useGravacoesDeCargo(): GravacoesDeCargo {
  const criar = useGravacao({
    executar: (d: DadosDoCargo) => chamar(c.criarCargo, { entrada: d }),
    sucesso: "Cargo criado",
    invalidar: INVALIDAR_CARGOS,
  });
  const alterar = useGravacao({
    executar: (d: DadosDoCargo) =>
      chamar(c.alterarCargo, {
        parametros: { chave: d.chave },
        entrada: { rotulo: d.rotulo, permissoes: d.permissoes },
      }),
    sucesso: "Cargo atualizado",
    invalidar: INVALIDAR_CARGOS,
  });
  const excluir = useGravacao({
    executar: (chave: string) => chamar(c.excluirCargo, { parametros: { chave } }),
    sucesso: "Cargo removido",
    invalidar: INVALIDAR_CARGOS,
  });
  return { criar, alterar, excluir };
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
          <DialogoCargo
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
      <DialogoCargo cargo={null} podeEditar aoGravar={criar.gravar} catalogo={catalogo} />
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

const VAZIO: DadosDoCargo = { chave: "", rotulo: "", permissoes: [] };

/** Criar (cargo `null`) ou editar um cargo: nome, chave e o editor de permissões. */
function DialogoCargo({
  cargo,
  podeEditar,
  aoGravar,
  catalogo,
}: {
  cargo: Cargo | null;
  podeEditar: boolean;
  aoGravar: (dados: DadosDoCargo) => Promise<boolean>;
  catalogo: CatalogoDeCargos;
}) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosDoCargo>(VAZIO);
  const [gravando, setGravando] = useState(false);
  const editando = cargo !== null;
  const temTudo = cargo?.temTudo ?? false;

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (abrir) setDados(cargo ? { ...cargo } : VAZIO);
  };
  const mudar = (parte: Partial<DadosDoCargo>) => {
    setDados((d) => ({ ...d, ...parte }));
  };
  const salvar = async () => {
    setGravando(true);
    const gravou = await aoGravar({ ...dados, rotulo: dados.rotulo.trim() });
    setGravando(false);
    if (gravou) setAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        {editando ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label={`${podeEditar ? "Editar" : "Ver"} ${cargo.rotulo}`}
            title={podeEditar ? "Editar cargo e permissões" : "Ver permissões do cargo"}
          >
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden />
            Novo cargo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editando ? cargo.rotulo : "Novo cargo"}</DialogTitle>
          <DialogDescription>
            O cargo é um grupo de usuários: o que ele pode ver e fazer vale para todos que estão
            nele. Para uma pessoa só, use as permissões dela na aba Usuários.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome">
            <input
              className={CAMPO}
              value={dados.rotulo}
              disabled={!podeEditar}
              onChange={(e) => {
                const rotulo = e.target.value;
                mudar(editando ? { rotulo } : { rotulo, chave: chaveDoNome(rotulo) });
              }}
            />
          </Campo>
          <Campo
            rotulo="Chave"
            ajuda="Identificador interno. Apenas minúsculas, números e _."
            erro={dados.chave.length === 1 ? "A chave precisa ter pelo menos 2 caracteres." : null}
          >
            <input
              className={`${CAMPO} font-mono`}
              value={dados.chave}
              disabled={editando}
              placeholder="ex.: conferente"
              onChange={(e) => {
                mudar({ chave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") });
              }}
            />
          </Campo>
        </div>
        <div className="space-y-2">
          <span className="label-xs">Permissões</span>
          {temTudo && <p className="text-xs text-muted-foreground">{catalogo.avisoTemTudo}</p>}
          <EditorDePermissoes
            permissoes={new Set(dados.permissoes)}
            categorias={catalogo.categorias}
            somenteLeitura={temTudo || !podeEditar}
            aoMudar={(permissoes) => {
              mudar({ permissoes: [...permissoes] });
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setAberto(false);
            }}
          >
            {podeEditar ? "Cancelar" : "Fechar"}
          </Button>
          {podeEditar && (
            <Button
              disabled={gravando || !dados.rotulo.trim() || dados.chave.length < 2}
              onClick={() => void salvar()}
            >
              {gravando ? "Salvando..." : editando ? "Salvar" : "Criar cargo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
