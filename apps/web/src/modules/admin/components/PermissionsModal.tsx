import { type Efeito, ROTULO_DA_ACAO } from "@erp/shared/access/permissions";
import { ROTULO_DA_TELA } from "@erp/shared/access/screens";
import { type Cargo, type UsuarioDaEmpresa } from "@erp/shared/contracts/admin";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Alternador } from "@/components/common/Toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  definirExcecao,
  listaDasExcecoes,
  mapaDasExcecoes,
  type MapaDeExcecoes,
  permissoesEfetivas,
  resumoDoAcesso,
  temAcao,
} from "../rules";
import { TabelaDePermissoes } from "./PermissionsTable";

type Escolha = "sim" | "padrao" | "nao";

const OPCOES: readonly { valor: Escolha; rotulo: string; dica: string }[] = [
  { valor: "sim", rotulo: "Sim", dica: "Concede mesmo sem o cargo" },
  { valor: "padrao", rotulo: "Padrão", dica: "Segue o cargo" },
  { valor: "nao", rotulo: "Não", dica: "Bloqueia mesmo com o cargo" },
];

const EFEITO_DA_ESCOLHA: Record<Escolha, Efeito | undefined> = {
  sim: "concede",
  padrao: undefined,
  nao: "nega",
};

const escolhaDo = (efeito: Efeito | undefined): Escolha =>
  efeito === "concede" ? "sim" : efeito === "nega" ? "nao" : "padrao";

/**
 * "Permissões — {nome}": exceções da pessoa por permissão (Sim / Não / Padrão), com o acesso
 * efetivo ao lado de cada uma (a mesma regra da API). Só o admin ajusta, e nunca as próprias.
 * origem: MemberPermissionsDialog (construgarden)
 */
export function ModalDePermissoes({
  usuario,
  cargo,
  ehVoce,
  podeAjustar,
  aoGravar,
}: {
  usuario: UsuarioDaEmpresa;
  cargo: Cargo | undefined;
  ehVoce: boolean;
  podeAjustar: boolean;
  aoGravar: (excecoes: ReturnType<typeof listaDasExcecoes>) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [mapa, setMapa] = useState<MapaDeExcecoes>(() => mapaDasExcecoes(usuario.excecoes));
  const [gravando, setGravando] = useState(false);
  const nome = usuario.nome ?? usuario.email;
  const editavel = podeAjustar && !ehVoce;
  const efetivas = permissoesEfetivas(usuario.papel, cargo?.permissoes ?? [], mapa);

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (abrir) setMapa(mapaDasExcecoes(usuario.excecoes));
  };
  const salvar = async () => {
    setGravando(true);
    const gravou = await aoGravar(listaDasExcecoes(mapa));
    setGravando(false);
    if (gravou) setAberto(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label={`Permissões de ${nome}`}
          title="Permissões"
        >
          <ShieldCheck aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Permissões — {nome}</DialogTitle>
          <DialogDescription>{resumoDoAcesso(mapa, efetivas)}</DialogDescription>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">
          Cargo: <span className="font-semibold text-foreground">{cargo?.rotulo ?? "—"}</span>.
          Marque Sim/Não para cada permissão — reflete o acesso efetivo deste usuário. Padrão segue
          o cargo.
        </p>
        {ehVoce && (
          <p className="rounded-lg bg-status-info-bg px-3 py-2 text-[13px] text-status-info-fg">
            Estas são as suas permissões: você não pode ajustá-las. Peça a outro administrador.
          </p>
        )}
        <TabelaDePermissoes
          larguraDaCelula="w-60"
          celula={(tela, acao) => {
            const ativa = temAcao(efetivas, tela, acao);
            const rotulo = `${ROTULO_DA_TELA[tela]}: ${ROTULO_DA_ACAO[acao]}`;
            return (
              <div className="flex items-center justify-center gap-2">
                <Alternador
                  tamanho="pequeno"
                  rotulo={rotulo}
                  opcoes={OPCOES}
                  valor={escolhaDo(mapa[`${tela}.${acao}`])}
                  aoMudar={(escolha) => {
                    if (editavel) {
                      setMapa((m) => definirExcecao(m, tela, acao, EFEITO_DA_ESCOLHA[escolha]));
                    }
                  }}
                  className={editavel ? undefined : "pointer-events-none opacity-60"}
                />
                <span title={ativa ? "Tem esta permissão" : "Não tem esta permissão"}>
                  {ativa ? (
                    <Check className="h-4 w-4 text-status-good-fg" aria-hidden />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="sr-only">{ativa ? "Ativa" : "Inativa"}</span>
                </span>
              </div>
            );
          }}
        />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={!editavel || listaDasExcecoes(mapa).length === 0}
            onClick={() => {
              setMapa({});
            }}
          >
            Voltar tudo ao padrão
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAberto(false);
              }}
            >
              {editavel ? "Cancelar" : "Fechar"}
            </Button>
            {editavel && (
              <Button disabled={gravando} onClick={() => void salvar()}>
                {gravando ? "Salvando..." : "Salvar permissões"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
