import { contratosPlataforma as p, type EmpresaResumo } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS, type StatusEmpresa } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { chamar } from "@/lib/api";
import { CabecalhoDaPagina, CAMPO, Campo, Selo, useGravacao } from "@/modulos/admin/comum";

import { CHAVES_DA_PLATAFORMA, consultaEmpresas } from "./api";

export const TOM_DO_STATUS: Record<StatusEmpresa, "alerta" | "bom" | "ruim" | "neutro"> = {
  implantacao: "alerta",
  ativa: "bom",
  suspensa: "ruim",
  encerrada: "neutro",
};

/** Identificador sugerido pelo nome: minúsculas, sem acento, hífen no lugar do resto. */
export function slugDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const COLUNAS: ColunaTabela<EmpresaResumo>[] = [
  {
    chave: "nome",
    titulo: "Empresa",
    celula: (e) => (
      <>
        <Link
          to="/plataforma/empresas/$id"
          params={{ id: e.id }}
          className="font-medium hover:underline"
        >
          {e.nome}
        </Link>
        <div className="text-[11px] text-muted-foreground">{e.slug}</div>
      </>
    ),
  },
  {
    chave: "status",
    titulo: "Status",
    valor: (e) => ROTULO_DO_STATUS[e.status],
    celula: (e) => <Selo tom={TOM_DO_STATUS[e.status]}>{ROTULO_DO_STATUS[e.status]}</Selo>,
  },
  { chave: "cnpj", titulo: "CNPJ", classe: "text-muted-foreground" },
  { chave: "usuariosAtivos", titulo: "Usuários ativos", formato: "inteiro" },
  { chave: "modulosLiberados", titulo: "Módulos liberados", formato: "inteiro" },
  { chave: "integracoesAtivas", titulo: "Integrações ligadas", formato: "inteiro" },
];

export function PaginaEmpresas() {
  const navigate = useNavigate();
  const consulta = useQuery(consultaEmpresas);
  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Empresas"
        descricao="Clientes da plataforma: dados, módulos liberados, usuários e integrações."
      >
        <ModalNovaEmpresa
          aoCriar={(id) => void navigate({ to: "/plataforma/empresas/$id", params: { id } })}
        />
      </CabecalhoDaPagina>
      <TabelaDados
        colunas={COLUNAS}
        linhas={consulta.data?.empresas ?? []}
        chaveDaLinha={(e) => e.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhuma empresa cadastrada."
      />
      <p className="text-[11px] text-muted-foreground">
        Módulos liberados não contam os essenciais.
      </p>
    </div>
  );
}

const VAZIA = { nome: "", nomeCurto: "", slug: "", cnpj: "" };

/** Nova empresa: nasce em implantação, com os roles padrão e os cadastros da empresa modelo. */
function ModalNovaEmpresa({ aoCriar }: { aoCriar: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState(VAZIA);
  const [slugEditado, setSlugEditado] = useState(false);
  const criar = useGravacao({
    executar: (dados: typeof VAZIA) => chamar(p.criarEmpresa, { entrada: dados }),
    sucesso: "Empresa criada",
    invalidar: [CHAVES_DA_PLATAFORMA.empresas],
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
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="grid grid-cols-2 gap-3">
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
