import { type EmpresaResumo } from "@erp/shared/contracts/platform";
import { ROTULO_DO_STATUS } from "@erp/shared/platform";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Pagina } from "@/components/layout/Page";

import { consultaEmpresas } from "./api";
import { ModalNovaEmpresa } from "./components/NewCompanyModal";
import { TOM_DO_STATUS } from "./texts";

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
