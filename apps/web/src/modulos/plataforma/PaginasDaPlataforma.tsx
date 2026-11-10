import { type AdminDaPlataforma, contratosPlataforma as p } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { CabecalhoDaPagina, Selo, useGravacao } from "@/modulos/admin/comum";
import { LogsComAbas, PainelAlteracoes } from "@/modulos/admin/logs/Logs";

import { AbaDados } from "./AbaDados";
import { AbaImplantacao, AbaIntegracoes, AbaModulos, AbaUsuarios } from "./AbasDaEmpresa";
import { CHAVES_DA_PLATAFORMA, consultaAdmins, consultaEmpresa, consultaEmpresas } from "./api";
import { TOM_DO_STATUS } from "./PaginaEmpresas";

const ABAS = [
  { valor: "dados", rotulo: "Dados" },
  { valor: "modulos", rotulo: "Módulos" },
  { valor: "usuarios", rotulo: "Usuários" },
  { valor: "integracoes", rotulo: "Integrações" },
  { valor: "logs", rotulo: "Logs" },
  { valor: "implantacao", rotulo: "Implantação" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

export function PaginaEmpresa({ id }: { id: string }) {
  const consulta = useQuery(consultaEmpresa(id));
  const [aba, setAba] = useState<Aba>("dados");
  const empresa = consulta.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/plataforma/empresas"
          className="mb-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Empresas
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-medium tracking-tight">
            {empresa?.nome ?? (consulta.isLoading ? "Carregando…" : "Empresa")}
          </h1>
          {empresa && (
            <Selo tom={TOM_DO_STATUS[empresa.status]}>{ROTULO_DO_STATUS[empresa.status]}</Selo>
          )}
        </div>
        {empresa && (
          <p className="text-[12px] text-muted-foreground">
            {empresa.slug}
            {empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}
          </p>
        )}
        {consulta.error && (
          <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        )}
      </div>

      {empresa && (
        <div className="space-y-4">
          <Abas abas={ABAS} valor={aba} aoMudar={setAba} />
          {aba === "dados" && <AbaDados empresa={empresa} />}
          {aba === "modulos" && <AbaModulos empresaId={id} />}
          {aba === "usuarios" && <AbaUsuarios empresaId={id} />}
          {aba === "integracoes" && <AbaIntegracoes empresaId={id} />}
          {aba === "logs" && <LogsComAbas empresaId={id} />}
          {aba === "implantacao" && <AbaImplantacao empresa={empresa} />}
        </div>
      )}
    </div>
  );
}

export function PaginaLogsDaPlataforma() {
  const empresas = useQuery(consultaEmpresas);
  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Logs"
        descricao="O que mudou em todas as empresas e na Plataforma, quem mudou e quando. Clique numa linha para ver o antes e o depois."
      />
      <PainelAlteracoes
        escopo={{
          empresas: (empresas.data?.empresas ?? []).map((e) => ({ id: e.id, nome: e.nome })),
        }}
      />
    </div>
  );
}

export function PaginaAdministradores() {
  const consulta = useQuery(consultaAdmins);
  const [email, setEmail] = useState("");
  const admins = consulta.data?.admins ?? [];
  const adicionar = useGravacao({
    executar: (novo: string) => chamar(p.adicionarAdmin, { entrada: { email: novo } }),
    sucesso: "Administrador adicionado",
    invalidar: [CHAVES_DA_PLATAFORMA.admins],
    aoConcluir: () => {
      setEmail("");
    },
  });
  const remover = useGravacao({
    executar: (usuarioId: string) => chamar(p.removerAdmin, { parametros: { usuarioId } }),
    sucesso: "Administrador removido",
    invalidar: [CHAVES_DA_PLATAFORMA.admins],
  });

  const colunas: ColunaTabela<AdminDaPlataforma>[] = [
    { chave: "nome", titulo: "Nome", classe: "font-medium" },
    { chave: "email", titulo: "E-mail", classe: "text-muted-foreground" },
    { chave: "criadoEm", titulo: "Desde", formato: "datahora", classe: "text-muted-foreground" },
    {
      chave: "acoes",
      titulo: "",
      ordenavel: false,
      semExportar: true,
      alinhamento: "direita",
      celula: (a) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remover ${a.email}`}
          disabled={admins.length <= 1 || remover.gravando}
          title={admins.length <= 1 ? "Não dá para remover o último administrador" : "Remover"}
          onClick={() => {
            const confirmou = window.confirm(
              `Remover ${a.email}? A pessoa deixa de ver a Plataforma e as outras empresas. O acesso à própria empresa continua.`,
            );
            if (confirmou) void remover.gravar(a.usuarioId);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Administradores"
        descricao="Equipe da Plataforma: vê e administra todas as empresas, as integrações e os logs."
      />
      <form
        className="flex max-w-xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void adicionar.gravar(email);
        }}
      >
        <input
          type="email"
          aria-label="E-mail do novo administrador"
          placeholder="E-mail de um usuário já cadastrado"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-[12px] shadow-sm"
        />
        <Button size="sm" type="submit" className="gap-1.5" disabled={adicionar.gravando}>
          <UserPlus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </form>
      <TabelaDados
        colunas={colunas}
        linhas={admins}
        chaveDaLinha={(a) => a.usuarioId}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum administrador."
      />
    </div>
  );
}
