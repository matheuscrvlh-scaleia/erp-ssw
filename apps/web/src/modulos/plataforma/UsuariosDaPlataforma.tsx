import { CARGO_SUPER_ADMIN_DA_PLATAFORMA } from "@erp/shared/acesso/papeis";
import { CATEGORIAS_DA_PLATAFORMA } from "@erp/shared/acesso/permissoes";
import { type Cargo } from "@erp/shared/contratos/admin";
import { type AdminDaPlataforma, contratosPlataforma as p } from "@erp/shared/contratos/plataforma";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { pode } from "@/acesso/permissao";
import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";
import { CHAVES } from "@/modulos/admin/api";
import { CAMPO, useGravacao } from "@/modulos/admin/comum";
import {
  type CatalogoDeCargos,
  type DadosDoCargo,
  type GravacoesDeCargo,
  useAbaCargos,
} from "@/modulos/admin/usuarios/AbaCargos";
import { MatrizDePermissoes } from "@/modulos/admin/usuarios/AbaMatriz";

import { CHAVES_DA_PLATAFORMA, consultaAdmins, consultaCargosDaPlataforma } from "./api";

export const ABAS_DA_PLATAFORMA = ["usuarios", "cargos", "matriz"] as const;
export type AbaDaPlataforma = (typeof ABAS_DA_PLATAFORMA)[number];

const ABAS: readonly { valor: AbaDaPlataforma; rotulo: string }[] = [
  { valor: "usuarios", rotulo: "Usuários" },
  { valor: "cargos", rotulo: "Cargos" },
  { valor: "matriz", rotulo: "Matriz de permissões" },
];

/** Mudar o cargo muda o acesso de quem está nele (inclusive o de quem edita). */
const INVALIDAR = [CHAVES_DA_PLATAFORMA.cargos, CHAVES_DA_PLATAFORMA.admins, CHAVES.acesso];

function useGravacoesDosCargosDaPlataforma(): GravacoesDeCargo {
  const criar = useGravacao({
    executar: (d: DadosDoCargo) => chamar(p.criarCargoDaPlataforma, { entrada: d }),
    sucesso: "Cargo criado",
    invalidar: INVALIDAR,
  });
  const alterar = useGravacao({
    executar: (d: DadosDoCargo) =>
      chamar(p.alterarCargoDaPlataforma, {
        parametros: { chave: d.chave },
        entrada: { rotulo: d.rotulo, permissoes: d.permissoes },
      }),
    sucesso: "Cargo atualizado",
    invalidar: INVALIDAR,
  });
  const excluir = useGravacao({
    executar: (chave: string) => chamar(p.excluirCargoDaPlataforma, { parametros: { chave } }),
    sucesso: "Cargo removido",
    invalidar: INVALIDAR,
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
  const equipe = useEquipe({
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
        <MatrizDePermissoes {...consultaDosCargos} podeEditar={podeEditar} catalogo={catalogo} />
      )}
    </Pagina>
  );
}

/** Aba Usuários: a equipe da Plataforma, o cargo de cada um e quem entra na equipe. */
function useEquipe({
  cargos,
  eu,
  podeEditar,
  podeExcluir,
}: {
  cargos: readonly Cargo[];
  eu: string;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const consulta = useQuery(consultaAdmins);
  const admins = consulta.data?.admins ?? [];
  const superAdmins = admins.filter((a) => a.cargo === CARGO_SUPER_ADMIN_DA_PLATAFORMA).length;
  const ultimoSuperAdmin = (a: AdminDaPlataforma) =>
    a.cargo === CARGO_SUPER_ADMIN_DA_PLATAFORMA && superAdmins <= 1;

  const trocar = useGravacao({
    executar: (d: { usuarioId: string; cargo: string }) =>
      chamar(p.trocarCargoDoAdmin, {
        parametros: { usuarioId: d.usuarioId },
        entrada: { cargo: d.cargo },
      }),
    sucesso: "Cargo alterado",
    invalidar: INVALIDAR,
  });
  const remover = useGravacao({
    executar: (usuarioId: string) => chamar(p.removerAdmin, { parametros: { usuarioId } }),
    sucesso: "Removido da equipe da Plataforma",
    invalidar: INVALIDAR,
  });

  const colunas: ColunaTabela<AdminDaPlataforma>[] = [
    {
      chave: "nome",
      titulo: "Usuário",
      valor: (a) => a.nome ?? a.email,
      celula: (a) => (
        <>
          <div className="font-semibold">
            {a.nome ?? "—"}
            {a.usuarioId === eu && (
              <span className="font-normal text-muted-foreground"> (você)</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{a.email}</div>
        </>
      ),
    },
    {
      chave: "cargoRotulo",
      titulo: "Cargo na Plataforma",
      celula: (a) =>
        podeEditar ? (
          <select
            aria-label={`Cargo de ${a.email}`}
            className={`${CAMPO} h-8 w-48`}
            value={a.cargo}
            disabled={trocar.gravando || ultimoSuperAdmin(a)}
            title={
              ultimoSuperAdmin(a) ? "A Plataforma precisa de pelo menos um Super Admin" : undefined
            }
            onChange={(e) => void trocar.gravar({ usuarioId: a.usuarioId, cargo: e.target.value })}
          >
            {cargos.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.rotulo}
              </option>
            ))}
          </select>
        ) : (
          a.cargoRotulo
        ),
    },
    { chave: "ultimoLoginEm", titulo: "Último acesso", formato: "datahora" },
    {
      chave: "criadoEm",
      titulo: "Na equipe desde",
      formato: "data",
      classe: "text-muted-foreground",
    },
    {
      chave: "ativo",
      titulo: "Status",
      valor: (a) => (a.ativo ? "Ativo" : "Inativo"),
      celula: (a) => (
        <SeloStatus tom={a.ativo ? "sucesso" : "erro"}>{a.ativo ? "Ativo" : "Inativo"}</SeloStatus>
      ),
    },
    ...(podeExcluir
      ? [
          {
            chave: "acoes",
            titulo: "",
            ordenavel: false,
            semExportar: true,
            alinhamento: "direita",
            celula: (a: AdminDaPlataforma) => (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-status-bad-fg hover:text-status-bad-fg"
                aria-label={`Tirar ${a.email} da equipe`}
                disabled={ultimoSuperAdmin(a) || remover.gravando}
                title={
                  ultimoSuperAdmin(a)
                    ? "A Plataforma precisa de pelo menos um Super Admin"
                    : "Tirar da equipe da Plataforma"
                }
                onClick={() => {
                  const confirmou = window.confirm(
                    `Tirar ${a.email} da equipe da Plataforma? A pessoa deixa de ver a Plataforma e as outras empresas. O acesso às empresas em que tem vínculo continua.`,
                  );
                  if (confirmou) void remover.gravar(a.usuarioId);
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            ),
          } satisfies ColunaTabela<AdminDaPlataforma>,
        ]
      : []),
  ];

  return {
    acoes: podeEditar && <AdicionarNaEquipe cargos={cargos} />,
    conteudo: (
      <TabelaDados
        colunas={colunas}
        linhas={admins}
        chaveDaLinha={(a) => a.usuarioId}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        mensagemVazia="Ninguém na equipe da Plataforma."
      />
    ),
  };
}

/** Põe na equipe quem já tem conta (a pessoa é convidada antes, numa empresa). */
function AdicionarNaEquipe({ cargos }: { cargos: readonly Cargo[] }) {
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const escolhido = cargo || cargos.find((c) => !c.temTudo)?.chave || (cargos[0]?.chave ?? "");
  const adicionar = useGravacao({
    executar: (d: { email: string; cargo: string }) => chamar(p.adicionarAdmin, { entrada: d }),
    sucesso: "Adicionado à equipe da Plataforma",
    invalidar: INVALIDAR,
    aoConcluir: () => {
      setEmail("");
    },
  });
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim() && escolhido) void adicionar.gravar({ email, cargo: escolhido });
      }}
    >
      <input
        type="email"
        aria-label="E-mail de quem entra na equipe"
        placeholder="E-mail de um usuário já cadastrado"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
        className={`${CAMPO} w-full sm:w-72`}
      />
      <select
        aria-label="Cargo na Plataforma"
        className={`${CAMPO} w-full sm:w-44`}
        value={escolhido}
        onChange={(e) => {
          setCargo(e.target.value);
        }}
      >
        {cargos.map((c) => (
          <option key={c.chave} value={c.chave}>
            {c.rotulo}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit" className="h-9" disabled={adicionar.gravando || !escolhido}>
        <UserPlus aria-hidden />
        Adicionar
      </Button>
    </form>
  );
}
