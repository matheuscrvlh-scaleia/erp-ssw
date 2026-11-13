import { type Cargo } from "@erp/shared/contracts/admin";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { CAMPO, Campo } from "@/components/common/FormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { chaveDoNome } from "../rules";
import { type CatalogoDeCargos, type DadosDoCargo } from "../use-roles-tab";
import { EditorDePermissoes } from "./PermissionsEditor";

const VAZIO: DadosDoCargo = { chave: "", rotulo: "", permissoes: [] };

/** Criar (cargo `null`) ou editar um cargo: nome, chave e o editor de permissões. */
export function ModalDeCargo({
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
