import { contratosPlataforma as p } from "@erp/shared/contratos/plataforma";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CAMPO, Campo } from "@/componentes/comum/CamposDeFormulario";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { useGravacao } from "@/hooks/use-gravacao";

import { mutacaoCriarEmpresa } from "../api";
import { slugDoNome } from "../regras";

const VAZIA = { nome: "", nomeCurto: "", slug: "", cnpj: "" };

/** A mesma regra que a API confere (contrato), avisada no campo enquanto digita. */
const erroDoSlug = (slug: string) =>
  p.criarEmpresa.entrada.shape.slug.safeParse(slug).error?.issues[0]?.message ?? null;

/** Nova empresa: nasce em implantação, com os roles padrão e os cadastros da empresa modelo. */
export function ModalNovaEmpresa({ aoCriar }: { aoCriar: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState(VAZIA);
  const [slugEditado, setSlugEditado] = useState(false);
  const cliente = useQueryClient();
  const criar = useGravacao({
    mutacao: mutacaoCriarEmpresa(cliente),
    sucesso: "Empresa criada",
    aoConcluir: ({ id }) => {
      setAberto(false);
      setCampos(VAZIA);
      setSlugEditado(false);
      aoCriar(id);
    },
  });
  const mudar = (parte: Partial<typeof VAZIA>) => {
    setCampos((c) => ({ ...c, ...parte }));
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden />
          Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Campo rotulo="Nome">
            <input
              className={CAMPO}
              placeholder="Ex.: Transportadora Exemplo"
              value={campos.nome}
              onChange={(e) => {
                const nome = e.target.value;
                mudar(slugEditado ? { nome } : { nome, slug: slugDoNome(nome) });
              }}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome curto">
              <input
                className={CAMPO}
                placeholder="Ex.: TE"
                value={campos.nomeCurto}
                onChange={(e) => {
                  mudar({ nomeCurto: e.target.value });
                }}
              />
            </Campo>
            <Campo rotulo="CNPJ">
              <input
                className={CAMPO}
                value={campos.cnpj}
                onChange={(e) => {
                  mudar({ cnpj: e.target.value });
                }}
              />
            </Campo>
          </div>
          <Campo
            rotulo="Identificador (slug)"
            ajuda="Letras minúsculas, números e hífen. Não muda depois."
            erro={campos.slug ? erroDoSlug(campos.slug) : null}
          >
            <input
              className={CAMPO}
              value={campos.slug}
              onChange={(e) => {
                mudar({ slug: e.target.value });
                setSlugEditado(true);
              }}
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void criar.gravar(campos)}
            disabled={
              criar.gravando ||
              campos.nome.trim().length < 2 ||
              !campos.nomeCurto.trim() ||
              !campos.slug
            }
          >
            {criar.gravando ? "Criando…" : "Criar empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
