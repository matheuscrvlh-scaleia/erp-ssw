import { contarItens, TELAS_EDITAVEIS } from "@erp/shared/acesso/editor-de-telas";
import { type Tela } from "@erp/shared/acesso/telas";
import { contratosAdmin as c } from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/componentes/ui/switch";
import { chamar } from "@/lib/api";

import { CHAVES, consultaCargos, consultaDepartamentos } from "../api";
import { CabecalhoDaPagina, CAMPO, Campo, Selo, useGravacao } from "../comum";
import { EditorDeMarcacao } from "../EditorDeTelas";

/** Cargo (Roles) e departamento: mesma tela, com descrição e ativo só no departamento. */
type TipoDeCadastro = "cargo" | "departamento";

interface ItemDoCadastro {
  chave: string;
  rotulo: string;
  descricao: string | null;
  ativo: boolean;
  protegido: boolean;
  telas: Tela[];
  usuarios: number;
}

type DadosDoCadastro = Omit<ItemDoCadastro, "protegido" | "usuarios">;

const TEXTOS = {
  cargo: {
    titulo: "Roles",
    descricao: "Crie níveis de acesso e defina quais módulos cada um pode acessar.",
    novo: "Novo role",
    vazio: "Nenhum role cadastrado.",
    exemplo: "ex: financeiro_jr",
  },
  departamento: {
    titulo: "Departamentos",
    descricao:
      "Crie departamentos e defina quais módulos cada um libera. As permissões do departamento se somam às do nível de acesso do usuário.",
    novo: "Novo departamento",
    vazio: "Nenhum departamento cadastrado.",
    exemplo: "ex: financeiro",
  },
} as const;

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

function useCadastro(tipo: TipoDeCadastro) {
  const cargos = useQuery({ ...consultaCargos, enabled: tipo === "cargo" });
  const departamentos = useQuery({ ...consultaDepartamentos, enabled: tipo === "departamento" });
  // Mudar telas de um cadastro muda o acesso de quem o usa (inclusive o de quem está editando).
  const invalidar = [CHAVES.cargos, CHAVES.departamentos, CHAVES.usuarios, CHAVES.acesso];
  const criar = useGravacao({
    executar: (d: DadosDoCadastro) =>
      tipo === "cargo"
        ? chamar(c.criarCargo, { entrada: { chave: d.chave, rotulo: d.rotulo, telas: d.telas } })
        : chamar(c.criarDepartamento, {
            entrada: { chave: d.chave, rotulo: d.rotulo, descricao: d.descricao, telas: d.telas },
          }),
    sucesso: tipo === "cargo" ? "Role criado" : "Departamento criado",
    invalidar,
  });
  const alterar = useGravacao({
    executar: (d: DadosDoCadastro) =>
      tipo === "cargo"
        ? chamar(c.alterarCargo, {
            parametros: { chave: d.chave },
            entrada: { rotulo: d.rotulo, telas: d.telas },
          })
        : chamar(c.alterarDepartamento, {
            parametros: { chave: d.chave },
            entrada: { rotulo: d.rotulo, descricao: d.descricao, ativo: d.ativo, telas: d.telas },
          }),
    sucesso: tipo === "cargo" ? "Role atualizado" : "Departamento atualizado",
    invalidar,
  });
  const excluir = useGravacao({
    executar: (chave: string) =>
      tipo === "cargo"
        ? chamar(c.excluirCargo, { parametros: { chave } })
        : chamar(c.excluirDepartamento, { parametros: { chave } }),
    sucesso: tipo === "cargo" ? "Role removido" : "Departamento removido",
    invalidar,
  });
  const consulta = tipo === "cargo" ? cargos : departamentos;
  const itens: ItemDoCadastro[] =
    (tipo === "cargo"
      ? cargos.data?.cargos.map((x) => ({ ...x, descricao: null, ativo: true }))
      : departamentos.data?.departamentos) ?? [];
  return { consulta, itens, criar, alterar, excluir };
}

export function PaginaDeCadastro({ tipo }: { tipo: TipoDeCadastro }) {
  const { consulta, itens, criar, alterar, excluir } = useCadastro(tipo);
  const textos = TEXTOS[tipo];

  const apagar = (item: ItemDoCadastro) => {
    const confirmou = window.confirm(
      `Apagar "${item.rotulo}"? Esta ação não pode ser desfeita. As permissões associadas serão removidas.`,
    );
    if (confirmou) void excluir.gravar(item.chave);
  };

  const colunas: ColunaTabela<ItemDoCadastro>[] = [
    {
      chave: "rotulo",
      titulo: "Nome",
      celula: (item) => (
        <div className="flex items-center gap-1.5">
          {item.protegido && <Lock className="h-3 w-3 text-muted-foreground" />}
          {item.rotulo}
          {item.protegido && <Selo>Protegido</Selo>}
        </div>
      ),
    },
    { chave: "chave", titulo: "Chave", classe: "font-mono text-[12px] text-muted-foreground" },
    {
      chave: "modulos",
      titulo: "Módulos",
      classe: "text-muted-foreground",
      valor: (item) =>
        tipo === "cargo" && item.protegido
          ? "Todos"
          : `${String(contarItens(item.telas))} de ${String(TELAS_EDITAVEIS.length)}`,
    },
    { chave: "usuarios", titulo: "Usuários", formato: "inteiro", classe: "text-muted-foreground" },
    ...(tipo === "departamento"
      ? [
          {
            chave: "ativo",
            titulo: "Status",
            valor: (item: ItemDoCadastro) => (item.ativo ? "Ativo" : "Inativo"),
            celula: (item: ItemDoCadastro) => (
              <Selo tom={item.ativo ? "bom" : "neutro"}>{item.ativo ? "Ativo" : "Inativo"}</Selo>
            ),
          },
        ]
      : []),
    {
      chave: "acoes",
      titulo: "",
      ordenavel: false,
      semExportar: true,
      alinhamento: "direita",
      celula: (item) => (
        <div className="flex justify-end gap-1">
          <ModalDeCadastro tipo={tipo} item={item} aoGravar={alterar.gravar} />
          {!item.protegido && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-destructive hover:text-destructive"
              disabled={excluir.gravando || item.usuarios > 0}
              aria-label={`Apagar ${item.rotulo}`}
              title={
                item.usuarios > 0
                  ? `Em uso por ${String(item.usuarios)} usuário(s)`
                  : `Apagar ${tipo === "cargo" ? "role" : "departamento"}`
              }
              onClick={() => {
                apagar(item);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina titulo={textos.titulo} descricao={textos.descricao}>
        <ModalDeCadastro tipo={tipo} item={null} aoGravar={criar.gravar} />
      </CabecalhoDaPagina>
      <TabelaDados
        colunas={colunas}
        linhas={itens}
        chaveDaLinha={(item) => item.chave}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia={textos.vazio}
      />
    </div>
  );
}

const VAZIO: DadosDoCadastro = { chave: "", rotulo: "", descricao: null, ativo: true, telas: [] };

function ModalDeCadastro({
  tipo,
  item,
  aoGravar,
}: {
  tipo: TipoDeCadastro;
  /** `null` = criar. */
  item: ItemDoCadastro | null;
  aoGravar: (dados: DadosDoCadastro) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosDoCadastro>(VAZIO);
  const [gravando, setGravando] = useState(false);
  const editando = item !== null;
  const cargoProtegido = tipo === "cargo" && (item?.protegido ?? false);

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (abrir) setDados(item ? { ...item } : VAZIO);
  };
  const mudar = (parte: Partial<DadosDoCadastro>) => {
    setDados((d) => ({ ...d, ...parte }));
  };
  const salvar = async () => {
    setGravando(true);
    const gravou = await aoGravar({ ...dados, descricao: dados.descricao?.trim() || null });
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
            className="h-7 px-2"
            aria-label={`Editar ${item.rotulo}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {TEXTOS[tipo].novo}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${item.rotulo}` : TEXTOS[tipo].novo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Campo rotulo="Nome">
            <input
              className={CAMPO}
              value={dados.rotulo}
              onChange={(e) => {
                const rotulo = e.target.value;
                mudar(editando ? { rotulo } : { rotulo, chave: chaveDoNome(rotulo) });
              }}
            />
          </Campo>
          <Campo rotulo="Chave" ajuda="Identificador interno. Apenas minúsculas, números e _.">
            <input
              className={`${CAMPO} font-mono text-[12px]`}
              value={dados.chave}
              disabled={editando}
              placeholder={TEXTOS[tipo].exemplo}
              onChange={(e) => {
                mudar({ chave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") });
              }}
            />
          </Campo>
          {tipo === "departamento" && (
            <Campo rotulo="Descrição (opcional)">
              <textarea
                rows={2}
                maxLength={300}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] shadow-sm"
                value={dados.descricao ?? ""}
                onChange={(e) => {
                  mudar({ descricao: e.target.value });
                }}
              />
            </Campo>
          )}
          {tipo === "departamento" && editando && (
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <span className="text-[13px] font-medium">Departamento ativo</span>
              <Switch
                aria-label="Departamento ativo"
                checked={dados.ativo}
                onCheckedChange={(ativo) => {
                  mudar({ ativo });
                }}
              />
            </div>
          )}
          <div>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Módulos liberados
            </span>
            {cargoProtegido ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Super Admin tem acesso a todos os módulos e não pode ser restringido.
              </p>
            ) : (
              <>
                {tipo === "departamento" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Telas administrativas só funcionam se o usuário também tiver nível admin/super
                    admin.
                  </p>
                )}
                <EditorDeMarcacao
                  marcadas={new Set(dados.telas)}
                  aoMudar={(marcadas) => {
                    mudar({ telas: [...marcadas] });
                  }}
                />
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setAberto(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={gravando || !dados.rotulo.trim() || dados.chave.length < 2}
            onClick={() => void salvar()}
          >
            {gravando ? "Salvando..." : editando ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
        {tipo === "departamento" && item?.protegido && (
          <p className="text-[11px] text-muted-foreground">
            Departamento protegido — exclusão bloqueada.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
