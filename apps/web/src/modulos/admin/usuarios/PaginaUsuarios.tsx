import {
  contratosAdmin as c,
  type NovoUsuario,
  type UsuarioDaEmpresa,
} from "@erp/shared/contratos/admin";
import { useQuery } from "@tanstack/react-query";
import { Mail, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { type ColunaTabela, TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { chamar } from "@/lib/api";

import { CHAVES, consultaCargos, consultaDepartamentos, consultaUsuarios } from "../api";
import { CabecalhoDaPagina, Selo, useGravacao } from "../comum";
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
            <Selo title={`${String(u.excecoes.length)} exceção(ões) individual(is)`}>Override</Selo>
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
          <Selo tom={u.ativo ? "bom" : "ruim"}>{u.ativo ? "Ativo" : "Inativo"}</Selo>
          {!u.temSenha && <Selo tom="alerta">Convite pendente</Selo>}
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
              className="h-7 px-2"
              title="Resetar overrides para o padrão do nível"
              aria-label="Resetar overrides"
              disabled={alterar.gravando}
              onClick={() => {
                zerarExcecoes(u);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {!u.temSenha && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              title="Reenviar convite"
              aria-label="Reenviar convite"
              disabled={reenviar.gravando}
              onClick={() => void reenviar.gravar(u.id)}
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoDaPagina
        titulo="Usuários"
        descricao="Gerencie acesso, setor e nível de cada usuário."
      >
        <ModalNovoUsuario
          cargos={opcoesDeCargo}
          departamentos={departamentosAtivos}
          aoGravar={criar.gravar}
        />
      </CabecalhoDaPagina>

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Buscar nome ou e-mail…"
          aria-label="Buscar"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
          }}
          className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-3 text-[12px] shadow-sm"
        />
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <select
            aria-label="Nível"
            value={nivel}
            onChange={(e) => {
              setNivel(e.target.value);
            }}
            className="h-8 w-[180px] rounded-md border border-input bg-background pl-6 pr-2 text-[12px] shadow-sm"
          >
            <option value="">Todos os níveis</option>
            {opcoesDeCargo.map((o) => (
              <option key={o.chave} value={o.chave}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

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
    </div>
  );
}
