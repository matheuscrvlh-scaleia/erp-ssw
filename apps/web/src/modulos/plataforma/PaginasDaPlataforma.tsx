import { type AdminDaPlataforma, contratosPlataforma as p } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { CAMPO, useGravacao } from "@/modulos/admin/comum";
import { useAlteracoes, useLogsComAbas } from "@/modulos/admin/logs/Logs";

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
  // Os filtros dos logs ficam na barra de filtros da página, como nas outras telas.
  const logs = useLogsComAbas({ empresaId: id, ativo: aba === "logs" && Boolean(empresa) });

  return (
    <Pagina
      titulo={
        <span className="inline-flex flex-wrap items-center gap-3">
          {empresa?.nome ?? (consulta.isLoading ? "Carregando…" : "Empresa")}
          {empresa && (
            <SeloStatus tom={TOM_DO_STATUS[empresa.status]}>
              {ROTULO_DO_STATUS[empresa.status]}
            </SeloStatus>
          )}
        </span>
      }
      descricao={
        empresa && (
          <>
            {empresa.slug}
            {empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}
          </>
        )
      }
      acoes={
        <Button asChild size="sm" variant="ghost">
          <Link to="/plataforma/empresas">
            <ArrowLeft aria-hidden />
            Empresas
          </Link>
        </Button>
      }
      abas={
        empresa && (
          // Seis abas não cabem no celular: a lista rola na horizontal em vez de estourar a página.
          <div className="rolagem-fina max-w-full overflow-x-auto pb-1">
            <Abas
              abas={ABAS}
              valor={aba}
              aoMudar={setAba}
              rotulo="Abas da empresa"
              className="w-max"
            />
          </div>
        )
      }
      filtros={
        empresa &&
        aba === "logs" && (
          <div className="flex flex-wrap items-center gap-2">
            {logs.alternador}
            {logs.filtros}
          </div>
        )
      }
    >
      {consulta.error && (
        <Painel>
          <MensagemErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        </Painel>
      )}
      {empresa && (
        <>
          {aba === "dados" && <AbaDados empresa={empresa} />}
          {aba === "modulos" && <AbaModulos empresaId={id} />}
          {aba === "usuarios" && <AbaUsuarios empresaId={id} />}
          {aba === "integracoes" && <AbaIntegracoes empresaId={id} />}
          {aba === "logs" && logs.conteudo}
          {aba === "implantacao" && <AbaImplantacao empresa={empresa} />}
        </>
      )}
    </Pagina>
  );
}

export function PaginaLogsDaPlataforma() {
  const empresas = useQuery(consultaEmpresas);
  const alteracoes = useAlteracoes({
    empresas: (empresas.data?.empresas ?? []).map((e) => ({ id: e.id, nome: e.nome })),
  });
  return (
    <Pagina
      titulo="Logs"
      descricao="O que mudou em todas as empresas e na Plataforma, quem mudou e quando. Clique numa linha para ver o antes e o depois."
      filtros={alteracoes.filtros}
    >
      {alteracoes.conteudo}
    </Pagina>
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
          className="h-8 w-8 p-0 text-status-bad-fg hover:text-status-bad-fg"
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
          <Trash2 aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <Pagina
      largura="estreita"
      titulo="Administradores"
      descricao="Equipe da Plataforma: vê e administra todas as empresas, as integrações e os logs."
    >
      <TabelaDados
        colunas={colunas}
        linhas={admins}
        chaveDaLinha={(a) => a.usuarioId}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Nenhum administrador."
        acoes={
          <form
            className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
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
              className={`${CAMPO} w-full sm:w-80`}
            />
            <Button size="sm" type="submit" className="h-9" disabled={adicionar.gravando}>
              <UserPlus aria-hidden />
              Adicionar
            </Button>
          </form>
        }
      />
    </Pagina>
  );
}
