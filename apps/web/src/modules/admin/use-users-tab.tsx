import { type Cargo, type UsuarioDaEmpresa } from "@erp/shared/contracts/admin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { type ReactNode, useState } from "react";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { BuscaNaBarra, Escolha } from "@/components/common/FormFields";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";

import {
  consultaUsuarios,
  mutacaoAlterarUsuario,
  mutacaoCriarUsuario,
  mutacaoDefinirExcecoes,
  mutacaoDefinirSenha,
  mutacaoReenviarConvite,
} from "./api";
import { ModalEditarUsuario } from "./components/EditUserModal";
import { ModalNovoUsuario, type Opcao } from "./components/NewUserModal";
import { ModalDePermissoes } from "./components/PermissionsModal";

const rotuloEm = (lista: readonly Opcao[], chave: string | null) =>
  lista.find((o) => o.chave === chave)?.rotulo ?? chave ?? "";

/**
 * Aba Usuários: cada pessoa com o cargo; editar dados e cargo, permissões individuais
 * (Sim/Não/Padrão), senha e convite.
 */
export function useAbaUsuarios({
  ativa,
  cargos,
  eu,
  podeEditar,
  podeAjustarPermissoes,
}: {
  ativa: boolean;
  cargos: readonly Cargo[];
  /** Id de quem está usando a tela (ninguém ajusta as próprias permissões). */
  eu: string;
  podeEditar: boolean;
  podeAjustarPermissoes: boolean;
}): { acoes: ReactNode; filtros: ReactNode; conteudo: ReactNode } {
  const usuarios = useQuery({ ...consultaUsuarios, enabled: ativa });
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState("");

  const cliente = useQueryClient();
  const criar = useGravacao({
    mutacao: mutacaoCriarUsuario(cliente),
    sucesso: (novo) => (novo.modo === "convite" ? "Convite enviado" : "Usuário criado"),
  });
  const alterar = useGravacao({
    mutacao: mutacaoAlterarUsuario(cliente),
    sucesso: "Usuário atualizado",
  });
  const definirExcecoes = useGravacao({
    mutacao: mutacaoDefinirExcecoes(cliente),
    sucesso: "Permissões atualizadas",
  });
  const definirSenha = useGravacao({
    mutacao: mutacaoDefinirSenha(cliente),
    sucesso: "Senha redefinida",
  });
  const reenviar = useGravacao({ mutacao: mutacaoReenviarConvite(), sucesso: "Convite reenviado" });

  const opcoesDeCargo: Opcao[] = cargos.map((x) => ({ chave: x.chave, rotulo: x.rotulo }));
  const todos = usuarios.data?.usuarios ?? [];
  const termo = busca.trim().toLowerCase();
  const filtrados = todos.filter(
    (u) =>
      (!cargo || u.papel === cargo) &&
      (!termo || (u.nome ?? "").toLowerCase().includes(termo) || u.email.includes(termo)),
  );

  const colunas: ColunaTabela<UsuarioDaEmpresa>[] = [
    { chave: "nome", titulo: "Usuário" },
    { chave: "email", titulo: "E-mail", classe: "text-muted-foreground" },
    {
      chave: "papel",
      titulo: "Cargo",
      valor: (u) => rotuloEm(opcoesDeCargo, u.papel),
      celula: (u) => (
        <div className="flex items-center gap-1.5">
          {rotuloEm(opcoesDeCargo, u.papel) || "—"}
          {u.excecoes.length > 0 && (
            <span title="Permissões individuais além do cargo (Sim/Não)">
              <SeloStatus tom="info">
                {u.excecoes.length === 1 ? "1 exceção" : `${String(u.excecoes.length)} exceções`}
              </SeloStatus>
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
          {podeEditar && (
            <ModalEditarUsuario
              usuario={u}
              cargos={opcoesDeCargo}
              aoGravar={(dados) => alterar.gravar({ id: u.id, dados })}
              aoDefinirSenha={(senha) => definirSenha.gravar({ id: u.id, senha })}
            />
          )}
          <ModalDePermissoes
            usuario={u}
            cargo={cargos.find((x) => x.chave === u.papel)}
            ehVoce={u.id === eu}
            podeAjustar={podeAjustarPermissoes}
            aoGravar={(excecoes) => definirExcecoes.gravar({ id: u.id, excecoes })}
          />
          {podeEditar && !u.temSenha && (
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

  return {
    acoes: podeEditar && <ModalNovoUsuario cargos={opcoesDeCargo} aoGravar={criar.gravar} />,
    filtros: (
      <FiltrosAvancados
        ativos={busca !== "" || cargo !== ""}
        aoLimpar={() => {
          setBusca("");
          setCargo("");
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
          rotulo="Cargo"
          vazio="Todos os cargos"
          opcoes={opcoesDeCargo.map((o) => ({ valor: o.chave, rotulo: o.rotulo }))}
          valor={cargo}
          aoMudar={setCargo}
        />
      </FiltrosAvancados>
    ),
    conteudo: (
      <TabelaDados
        colunas={colunas}
        linhas={filtrados}
        chaveDaLinha={(u) => u.id}
        carregando={usuarios.isLoading}
        erro={usuarios.error}
        aoTentarDeNovo={() => void usuarios.refetch()}
        mensagemVazia="Nenhum usuário encontrado."
        rotuloTotal={(n) => `${String(n)} de ${String(todos.length)}`}
      />
    ),
  };
}
