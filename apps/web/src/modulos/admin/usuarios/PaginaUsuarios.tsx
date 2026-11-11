import {
  contratosAdmin as c,
  type NovoUsuario,
  type UsuarioDaEmpresa,
} from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { Mail, RotateCcw } from "lucide-react";
import { useState } from "react";

import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";

import { CHAVES, consultaCargos, consultaDepartamentos, consultaUsuarios } from "../api";
import { BuscaNaBarra, Escolha, useGravacao } from "../comum";
import { type AlteracaoDeUsuario, ModalEditarUsuario } from "./ModalEditarUsuario";
import { ModalNovoUsuario, type Opcao } from "./ModalNovoUsuario";

const rotuloEm = (lista: readonly Opcao[], chave: string | null) =>
  lista.find((o) => o.chave === chave)?.rotulo ?? chave ?? "";

export function PaginaUsuarios() {
  const usuarios = useQuery(consultaUsuarios);
  const cargos = useQuery(consultaCargos);
  const departamentos = useQuery(consultaDepartamentos);
  const [busca, setBusca] = useState("");
  const [nivel, setNivel] = useState("");

  const invalidar = [CHAVES.usuarios, CHAVES.cargos, CHAVES.departamentos];
  const criar = useGravacao({
    executar: (novo: NovoUsuario) => chamar(c.criarUsuario, { entrada: novo }),
    sucesso: (novo) => (novo.modo === "convite" ? "Convite enviado" : "Usuário criado"),
    invalidar,
  });
  const alterar = useGravacao({
    executar: ({ id, dados }: { id: string; dados: AlteracaoDeUsuario }) =>
      chamar(c.alterarUsuario, { parametros: { id }, entrada: dados }),
    sucesso: "Usuário atualizado",
    invalidar,
  });
  const definirSenha = useGravacao({
    executar: ({ id, senha }: { id: string; senha: string }) =>
      chamar(c.definirSenha, { parametros: { id }, entrada: { senha } }),
    sucesso: "Senha redefinida",
    invalidar: [CHAVES.usuarios],
  });
  const reenviar = useGravacao({
    executar: (id: string) => chamar(c.reenviarConvite, { parametros: { id } }),
    sucesso: "Convite reenviado",
    invalidar: [],
  });

  const opcoesDeCargo: Opcao[] =
    cargos.data?.cargos.map((x) => ({ chave: x.chave, rotulo: x.rotulo })) ?? [];
  const listaDeDepartamentos = departamentos.data?.departamentos ?? [];
  const todosOsDepartamentos: Opcao[] = listaDeDepartamentos.map((d) => ({
    chave: d.chave,
    rotulo: d.rotulo,
  }));
  const departamentosAtivos: Opcao[] = listaDeDepartamentos
    .filter((d) => d.ativo)
    .map((d) => ({ chave: d.chave, rotulo: d.rotulo }));

  const todos = usuarios.data?.usuarios ?? [];
  const termo = busca.trim().toLowerCase();
  const filtrados = todos.filter(
    (u) =>
      (!nivel || u.papel === nivel) &&
      (!termo || (u.nome ?? "").toLowerCase().includes(termo) || u.email.includes(termo)),
  );

  const zerarExcecoes = (u: UsuarioDaEmpresa) =>
    void alterar.gravar({
      id: u.id,
      dados: {
        nome: u.nome ?? u.email,
        email: u.email,
        papel: u.papel ?? "operador",
        departamento: u.departamento,
        ativo: u.ativo,
        excecoes: [],
      },
    });

  const colunas: ColunaTabela<UsuarioDaEmpresa>[] = [
    { chave: "nome", titulo: "Nome" },
    { chave: "email", titulo: "E-mail", classe: "text-muted-foreground" },
    {
      chave: "departamento",
      titulo: "Departamento",
      valor: (u) => rotuloEm(todosOsDepartamentos, u.departamento),
    },
    {
      chave: "papel",
      titulo: "Nível",
      valor: (u) => rotuloEm(opcoesDeCargo, u.papel),
      celula: (u) => (
        <div className="flex items-center gap-1.5">
          {rotuloEm(opcoesDeCargo, u.papel) || "—"}
          {u.excecoes.length > 0 && (
            <span title={`${String(u.excecoes.length)} exceção(ões) individual(is)`}>
              <SeloStatus tom="info">Override</SeloStatus>
            </span>
          )}
        </div>
      ),
    },
    {
      chave: "ativo",
      titulo: "Status",
      valor: (u) => (u.ativo ? "Ativo" : "Inativo"),
      celula: (u) => (
        <div className="flex flex-wrap gap-1">
          <SeloStatus tom={u.ativo ? "sucesso" : "erro"}>
            {u.ativo ? "Ativo" : "Inativo"}
          </SeloStatus>
          {!u.temSenha && <SeloStatus tom="alerta">Convite pendente</SeloStatus>}
        </div>
      ),
    },
    {
      chave: "acoes",
      titulo: "",
      ordenavel: false,
      semExportar: true,
      alinhamento: "direita",
      celula: (u) => (
        <div className="flex justify-end gap-1">
          <ModalEditarUsuario
            usuario={u}
            cargos={opcoesDeCargo}
            departamentos={departamentosAtivos}
            aoGravar={(dados) => alterar.gravar({ id: u.id, dados })}
            aoDefinirSenha={(senha) => definirSenha.gravar({ id: u.id, senha })}
          />
          {u.excecoes.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Resetar overrides para o padrão do nível"
              aria-label="Resetar overrides"
              disabled={alterar.gravando}
              onClick={() => {
                zerarExcecoes(u);
              }}
            >
              <RotateCcw aria-hidden />
            </Button>
          )}
          {!u.temSenha && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Reenviar convite"
              aria-label="Reenviar convite"
              disabled={reenviar.gravando}
              onClick={() => void reenviar.gravar(u.id)}
            >
              <Mail aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Pagina
      titulo="Usuários"
      descricao="Gerencie acesso, setor e nível de cada usuário."
      acoes={
        <ModalNovoUsuario
          cargos={opcoesDeCargo}
          departamentos={departamentosAtivos}
          aoGravar={criar.gravar}
        />
      }
      filtros={
        <FiltrosAvancados
          ativos={busca !== "" || nivel !== ""}
          aoLimpar={() => {
            setBusca("");
            setNivel("");
          }}
        >
          <BuscaNaBarra
            rotulo="Buscar"
            placeholder="Buscar nome ou e-mail…"
            valor={busca}
            aoMudar={setBusca}
          />
          <Escolha
            filtro
            rotulo="Nível"
            vazio="Todos os níveis"
            opcoes={opcoesDeCargo.map((o) => ({ valor: o.chave, rotulo: o.rotulo }))}
            valor={nivel}
            aoMudar={setNivel}
          />
        </FiltrosAvancados>
      }
    >
      <TabelaDados
        colunas={colunas}
        linhas={filtrados}
        chaveDaLinha={(u) => u.id}
        carregando={usuarios.isLoading || cargos.isLoading || departamentos.isLoading}
        erro={usuarios.error ?? cargos.error ?? departamentos.error}
        aoTentarDeNovo={() => void usuarios.refetch()}
        mensagemVazia="Nenhum usuário encontrado."
        rotuloTotal={(n) => `${String(n)} de ${String(todos.length)}`}
      />
    </Pagina>
  );
}
