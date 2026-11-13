import { CATEGORIAS_DE_TELA } from "@erp/shared/access/permissions";
import { ehAdminDaEmpresa } from "@erp/shared/access/roles";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { pode } from "@/access/permission";
import { consultaAcesso } from "@/access/session";
import { Abas } from "@/components/common/Tabs";
import { Pagina } from "@/components/layout/Page";
import { useGravacao } from "@/hooks/use-save";

import { consultaCargos, mutacaoAlterarCargo, mutacaoCriarCargo, mutacaoExcluirCargo } from "./api";
import { MatrizDeCargos } from "./components/RoleMatrix";
import { AVISO_TEM_TUDO_DA_EMPRESA } from "./texts";
import { type GravacoesDeCargo, useAbaCargos } from "./use-roles-tab";
import { useAbaUsuarios } from "./use-users-tab";

export const ABAS_DE_USUARIOS = ["usuarios", "cargos", "acessos", "permissoes"] as const;
export type AbaDeUsuarios = (typeof ABAS_DE_USUARIOS)[number];

const ABAS: readonly { valor: AbaDeUsuarios; rotulo: string }[] = [
  { valor: "usuarios", rotulo: "Usuários" },
  { valor: "cargos", rotulo: "Cargos" },
  { valor: "acessos", rotulo: "Matriz de acessos" },
  { valor: "permissoes", rotulo: "Matriz de permissões" },
];

/**
 * Administração › Usuários e cargos: o cargo é o grupo de usuários com permissões por ação; a
 * pessoa pode ter exceções (Sim/Não). Gerir acesso é do admin da empresa; cada ação ainda segue
 * a permissão da tela (Usuários = `admin_usuarios`, Cargos e as duas matrizes = `admin_roles`).
 */
export function PaginaUsuariosECargos({
  aba,
  aoMudarAba,
}: {
  aba: AbaDeUsuarios | undefined;
  aoMudarAba: (aba: AbaDeUsuarios) => void;
}) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const gestor = acesso.adminPlataforma || ehAdminDaEmpresa(acesso.papel);
  const veUsuarios = pode(acesso, "admin_usuarios", "ver");
  const veCargos = pode(acesso, "admin_roles", "ver");
  const atual = aba ?? (veUsuarios ? "usuarios" : "cargos");
  const disponiveis = ABAS.filter((a) => (a.valor === "usuarios" ? veUsuarios : veCargos));

  const catalogo = {
    categorias: CATEGORIAS_DE_TELA,
    avisoTemTudo: AVISO_TEM_TUDO_DA_EMPRESA,
    gravacoes: useGravacoesDeCargo(),
  };
  const cargos = useQuery(consultaCargos);
  const listaDeCargos = cargos.data?.cargos ?? [];
  const consultaDosCargos = {
    cargos: listaDeCargos,
    carregando: cargos.isLoading,
    erro: cargos.error,
    aoTentarDeNovo: () => void cargos.refetch(),
  };

  const usuarios = useAbaUsuarios({
    ativa: atual === "usuarios" && veUsuarios,
    cargos: listaDeCargos,
    eu: acesso.usuario.id,
    podeEditar: gestor && pode(acesso, "admin_usuarios", "editar"),
    podeAjustarPermissoes: gestor && pode(acesso, "admin_usuarios", "editar"),
  });
  const podeEditarCargos = gestor && pode(acesso, "admin_roles", "editar");
  const abaCargos = useAbaCargos({
    ...consultaDosCargos,
    podeEditar: podeEditarCargos,
    podeExcluir: gestor && pode(acesso, "admin_roles", "excluir"),
    catalogo,
  });

  return (
    <Pagina
      titulo="Usuários e cargos"
      descricao="Cargo é o grupo de usuários: o que cada pessoa vê e faz vem do cargo e, se preciso, das permissões dela."
      acoes={atual === "usuarios" ? usuarios.acoes : atual === "cargos" ? abaCargos.acoes : null}
      abas={
        disponiveis.length > 1 && (
          <Abas abas={disponiveis} valor={atual} aoMudar={aoMudarAba} rotulo="Usuários e cargos" />
        )
      }
      filtros={atual === "usuarios" ? usuarios.filtros : null}
    >
      {atual === "usuarios" ? (
        usuarios.conteudo
      ) : atual === "cargos" ? (
        abaCargos.conteudo
      ) : (
        <MatrizDeCargos
          matriz={atual}
          {...consultaDosCargos}
          podeEditar={podeEditarCargos}
          catalogo={catalogo}
        />
      )}
    </Pagina>
  );
}

function useGravacoesDeCargo(): GravacoesDeCargo {
  const cliente = useQueryClient();
  const criar = useGravacao({ mutacao: mutacaoCriarCargo(cliente), sucesso: "Cargo criado" });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarCargo(cliente),
    sucesso: "Cargo atualizado",
  });
  const excluir = useGravacao({ mutacao: mutacaoExcluirCargo(cliente), sucesso: "Cargo removido" });
  return { criar, alterar, excluir };
}
