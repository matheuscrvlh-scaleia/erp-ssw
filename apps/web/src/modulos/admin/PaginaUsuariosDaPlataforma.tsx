import { CATEGORIAS_DA_PLATAFORMA } from "@erp/shared/acesso/permissoes";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { Pagina } from "@/componentes/layout/Pagina";
import { useGravacao } from "@/hooks/use-gravacao";
import {
  consultaCargosDaPlataforma,
  mutacaoAlterarCargoDaPlataforma,
  mutacaoCriarCargoDaPlataforma,
  mutacaoExcluirCargoDaPlataforma,
} from "@/modulos/plataforma/api";

import { MatrizDeCargos } from "./componentes/MatrizDeCargos";
import { type CatalogoDeCargos, type GravacoesDeCargo, useAbaCargos } from "./use-aba-cargos";
import { useEquipeDaPlataforma } from "./use-equipe-da-plataforma";

export const ABAS_DA_PLATAFORMA = ["usuarios", "cargos", "acessos", "permissoes"] as const;
type AbaDaPlataforma = (typeof ABAS_DA_PLATAFORMA)[number];

const ABAS: readonly { valor: AbaDaPlataforma; rotulo: string }[] = [
  { valor: "usuarios", rotulo: "Usuários" },
  { valor: "cargos", rotulo: "Cargos" },
  { valor: "acessos", rotulo: "Matriz de acessos" },
  { valor: "permissoes", rotulo: "Matriz de permissões" },
];

function useGravacoesDosCargosDaPlataforma(): GravacoesDeCargo {
  const cliente = useQueryClient();
  const criar = useGravacao({
    mutacao: mutacaoCriarCargoDaPlataforma(cliente),
    sucesso: "Cargo criado",
  });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarCargoDaPlataforma(cliente),
    sucesso: "Cargo atualizado",
  });
  const excluir = useGravacao({
    mutacao: mutacaoExcluirCargoDaPlataforma(cliente),
    sucesso: "Cargo removido",
  });
  return { criar, alterar, excluir };
}

/**
 * Plataforma › Usuários e cargos: só a equipe da Plataforma, quem entra em todas as empresas. O
 * cargo da Plataforma diz o que cada um vê e faz nas telas da Plataforma. Os usuários de cada
 * empresa ficam em Administração › Usuários e cargos, dentro da empresa.
 */
export function PaginaUsuariosDaPlataforma({
  aba,
  aoMudarAba,
}: {
  aba: AbaDaPlataforma;
  aoMudarAba: (aba: AbaDaPlataforma) => void;
}) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const podeEditar = pode(acesso, "plataforma_admins", "editar");
  const podeExcluir = pode(acesso, "plataforma_admins", "excluir");
  const catalogo: CatalogoDeCargos = {
    categorias: CATEGORIAS_DA_PLATAFORMA,
    avisoTemTudo:
      "O Super Admin tem todas as permissões da Plataforma e não pode ser restringido. A Plataforma precisa de pelo menos um.",
    gravacoes: useGravacoesDosCargosDaPlataforma(),
  };

  const cargos = useQuery(consultaCargosDaPlataforma);
  const consultaDosCargos = {
    cargos: cargos.data?.cargos ?? [],
    carregando: cargos.isLoading,
    erro: cargos.error,
    aoTentarDeNovo: () => void cargos.refetch(),
  };
  const abaCargos = useAbaCargos({ ...consultaDosCargos, podeEditar, podeExcluir, catalogo });
  const equipe = useEquipeDaPlataforma({
    cargos: consultaDosCargos.cargos,
    eu: acesso.usuario.id,
    podeEditar,
    podeExcluir,
  });

  return (
    <Pagina
      titulo="Usuários e cargos"
      descricao="A equipe da Plataforma entra em todas as empresas; o cargo diz o que cada um vê e faz na Plataforma."
      acoes={aba === "usuarios" ? equipe.acoes : aba === "cargos" ? abaCargos.acoes : null}
      abas={<Abas abas={ABAS} valor={aba} aoMudar={aoMudarAba} rotulo="Usuários e cargos" />}
    >
      {aba === "usuarios" ? (
        equipe.conteudo
      ) : aba === "cargos" ? (
        abaCargos.conteudo
      ) : (
        <MatrizDeCargos
          matriz={aba}
          {...consultaDosCargos}
          podeEditar={podeEditar}
          catalogo={catalogo}
        />
      )}
    </Pagina>
  );
}
