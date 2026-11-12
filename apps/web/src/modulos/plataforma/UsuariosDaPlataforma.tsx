import { type PessoaDaPlataforma } from "@erp/shared/contratos/plataforma";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { BuscaNaBarra } from "@/modulos/admin/comum";

import { consultaPessoas } from "./api";
import { ListaDeAdministradores } from "./PaginasDaPlataforma";

export const ABAS_DA_PLATAFORMA = ["administradores", "usuarios"] as const;
export type AbaDaPlataforma = (typeof ABAS_DA_PLATAFORMA)[number];

const ABAS: readonly { valor: AbaDaPlataforma; rotulo: string }[] = [
  { valor: "administradores", rotulo: "Administradores da Plataforma" },
  { valor: "usuarios", rotulo: "Usuários" },
];

/**
 * Plataforma › Usuários e cargos: a equipe da Plataforma (vê e administra tudo) e todas as
 * pessoas com o cargo em cada empresa. Cargos e permissões de cada empresa ficam em Usuários e
 * cargos da própria empresa; o vínculo, na aba Usuários da empresa.
 */
export function PaginaUsuariosDaPlataforma({
  aba,
  aoMudarAba,
}: {
  aba: AbaDaPlataforma;
  aoMudarAba: (aba: AbaDaPlataforma) => void;
}) {
  const [busca, setBusca] = useState("");
  return (
    <Pagina
      titulo="Usuários e cargos"
      descricao="Equipe da Plataforma e o cargo de cada pessoa em cada empresa."
      abas={<Abas abas={ABAS} valor={aba} aoMudar={aoMudarAba} rotulo="Usuários e cargos" />}
      filtros={
        aba === "usuarios" && (
          <FiltrosAvancados
            ativos={busca !== ""}
            aoLimpar={() => {
              setBusca("");
            }}
          >
            <BuscaNaBarra
              rotulo="Buscar"
              placeholder="Buscar nome, e-mail ou empresa…"
              valor={busca}
              aoMudar={setBusca}
            />
          </FiltrosAvancados>
        )
      }
    >
      {aba === "administradores" ? <ListaDeAdministradores /> : <ListaDePessoas busca={busca} />}
    </Pagina>
  );
}

function ListaDePessoas({ busca }: { busca: string }) {
  const consulta = useQuery(consultaPessoas);
  const todas = consulta.data?.pessoas ?? [];
  const termo = busca.trim().toLowerCase();
  const filtradas = todas.filter(
    (p) =>
      !termo ||
      (p.nome ?? "").toLowerCase().includes(termo) ||
      p.email.includes(termo) ||
      p.empresas.some((e) => e.empresaNome.toLowerCase().includes(termo)),
  );

  const colunas: ColunaTabela<PessoaDaPlataforma>[] = [
    {
      chave: "nome",
      titulo: "Usuário",
      celula: (p) => (
        <>
          <div className="font-semibold">{p.nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{p.email}</div>
        </>
      ),
    },
    {
      chave: "empresas",
      titulo: "Empresa · cargo",
      ordenavel: false,
      valor: (p) =>
        p.empresas.map((e) => `${e.empresaNome} · ${e.cargoRotulo ?? "sem cargo"}`).join("; "),
      celula: (p) =>
        p.empresas.length === 0 ? (
          <span className="text-muted-foreground">Sem empresa</span>
        ) : (
          <ul className="space-y-0.5">
            {p.empresas.map((e) => (
              <li key={e.empresaId} className={e.ativo ? undefined : "text-muted-foreground"}>
                <Link
                  to="/plataforma/empresas/$id"
                  params={{ id: e.empresaId }}
                  className="font-medium hover:underline"
                >
                  {e.empresaNome}
                </Link>{" "}
                · {e.cargoRotulo ?? e.papel ?? "sem cargo"}
                {!e.ativo && " (inativo)"}
              </li>
            ))}
          </ul>
        ),
    },
    {
      chave: "adminPlataforma",
      titulo: "Plataforma",
      valor: (p) => (p.adminPlataforma ? "Sim" : "Não"),
      celula: (p) =>
        p.adminPlataforma ? (
          <SeloStatus tom="info" icone={KeyRound}>
            Administrador
          </SeloStatus>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      chave: "ativo",
      titulo: "Status",
      valor: (p) => (p.ativo ? "Ativo" : "Inativo"),
      celula: (p) => (
        <SeloStatus tom={p.ativo ? "sucesso" : "erro"}>{p.ativo ? "Ativo" : "Inativo"}</SeloStatus>
      ),
    },
  ];

  return (
    <TabelaDados
      colunas={colunas}
      linhas={filtradas}
      chaveDaLinha={(p) => p.id}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoTentarDeNovo={() => void consulta.refetch()}
      mensagemVazia="Ninguém encontrado."
      rotuloTotal={(n) => `${String(n)} de ${String(todas.length)}`}
    />
  );
}
