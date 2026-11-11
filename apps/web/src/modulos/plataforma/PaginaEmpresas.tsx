import { contratosPlataforma as p, type EmpresaResumo } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS, type StatusEmpresa } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
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
import { CAMPO, Campo, useGravacao } from "@/modulos/admin/comum";

import { CHAVES_DA_PLATAFORMA, consultaEmpresas } from "./api";

export const TOM_DO_STATUS: Record<StatusEmpresa, Tom> = {
  implantacao: "alerta",
  ativa: "sucesso",
  suspensa: "erro",
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
          className="font-semibold text-foreground hover:text-brand hover:underline"
        >
          {e.nome}
        </Link>
        <div className="text-xs text-muted-foreground">{e.slug}</div>
      </>
    ),
  },
  {
    chave: "status",
    titulo: "Status",
    valor: (e) => ROTULO_DO_STATUS[e.status],
    celula: (e) => (
      <SeloStatus tom={TOM_DO_STATUS[e.status]}>{ROTULO_DO_STATUS[e.status]}</SeloStatus>
    ),
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
    <Pagina
      titulo="Empresas"
      descricao="Clientes da plataforma: dados, módulos liberados, usuários e integrações."
      acoes={
        <ModalNovaEmpresa
          aoCriar={(id) => void navigate({ to: "/plataforma/empresas/$id", params: { id } })}
        />
      }
    >
      <TabelaDados
        colunas={COLUNAS}
        linhas={consulta.data?.empresas ?? []}
        chaveDaLinha={(e) => e.id}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhuma empresa cadastrada."
      />
      <p className="text-xs text-muted-foreground">Módulos liberados não contam os essenciais.</p>
    </Pagina>
  );
}

const VAZIA = { nome: "", nomeCurto: "", slug: "", cnpj: "" };

/** A mesma regra que a API confere (contrato), avisada no campo enquanto digita. */
const erroDoSlug = (slug: string) =>
  p.criarEmpresa.entrada.shape.slug.safeParse(slug).error?.issues[0]?.message ?? null;

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
