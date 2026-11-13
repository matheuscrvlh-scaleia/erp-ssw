import { CARGO_SUPER_ADMIN_DA_PLATAFORMA } from "@erp/shared/access/roles";
import { type Cargo } from "@erp/shared/contracts/admin";
import { type AdminDaPlataforma } from "@erp/shared/contracts/platform";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { type ColunaTabela, TabelaDados } from "@/components/common/DataTable";
import { CAMPO } from "@/components/common/FormFields";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";
import {
  consultaAdmins,
  mutacaoRemoverAdmin,
  mutacaoTrocarCargoDoAdmin,
} from "@/modules/platform/api";

import { AdicionarNaEquipe } from "./components/AddToTeam";

/** Plataforma › Usuários e cargos, aba Usuários: a equipe, o cargo de cada um e quem entra nela. */
export function useEquipeDaPlataforma({
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

  const cliente = useQueryClient();
  const trocar = useGravacao({
    mutacao: mutacaoTrocarCargoDoAdmin(cliente),
    sucesso: "Cargo alterado",
  });
  const remover = useGravacao({
    mutacao: mutacaoRemoverAdmin(cliente),
    sucesso: "Removido da equipe da Plataforma",
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
