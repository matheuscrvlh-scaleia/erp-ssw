import { type EmpresaResumo } from "@erp/shared/contratos/plataforma";
import { ROTULO_DO_STATUS } from "@erp/shared/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";

import { consultaEmpresas } from "./api";
import { ModalNovaEmpresa } from "./componentes/ModalNovaEmpresa";
import { TOM_DO_STATUS } from "./textos";

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
