import { type EntradaDe } from "@erp/shared/contrato";
import { type contratosAdmin, type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";
import { ArrowRight, Check, Copy, KeyRound, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";

import {
  BotaoDoCampo,
  CAMPO,
  Campo,
  CampoDeSenha,
  Escolha,
} from "@/componentes/comum/CamposDeFormulario";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { Switch } from "@/componentes/ui/switch";

import { gerarSenha } from "../regras";
import { type Opcao } from "./ModalNovoUsuario";

type AlteracaoDeUsuario = EntradaDe<typeof contratosAdmin.alterarUsuario>;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Troca {
  rotulo: string;
  antes: string;
  depois: string;
}

function estadoInicial(u: UsuarioDaEmpresa) {
  return {
    nome: u.nome ?? "",
    email: u.email,
    papel: u.papel ?? "operador",
    ativo: u.ativo,
  };
}

/** Dados gerais alterados, para a revisão antes de salvar. */
function trocasGerais(
  u: UsuarioDaEmpresa,
  e: ReturnType<typeof estadoInicial>,
  rotuloDoCargo: (c: string) => string,
): Troca[] {
  const trocas: Troca[] = [];
  const comparar = (rotulo: string, antes: string, depois: string) => {
    if (antes !== depois) trocas.push({ rotulo, antes: antes || "—", depois: depois || "—" });
  };
  comparar("Nome", u.nome ?? "", e.nome.trim());
  comparar("E-mail", u.email, e.email.trim().toLowerCase());
  comparar("Cargo", u.papel ? rotuloDoCargo(u.papel) : "", rotuloDoCargo(e.papel));
  comparar("Status", u.ativo ? "Ativo" : "Inativo", e.ativo ? "Ativo" : "Inativo");
  return trocas;
}

export function ModalEditarUsuario({
  usuario,
  cargos,
  aoGravar,
  aoDefinirSenha,
}: {
  usuario: UsuarioDaEmpresa;
  cargos: readonly Opcao[];
  aoGravar: (dados: AlteracaoDeUsuario) => Promise<boolean>;
  aoDefinirSenha: (senha: string) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [campos, setCampos] = useState(() => estadoInicial(usuario));
  const [novaSenha, setNovaSenha] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [gravando, setGravando] = useState(false);

  const mudar = (parte: Partial<typeof campos>) => {
    setCampos((c) => ({ ...c, ...parte }));
  };
  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    setRevisando(false);
    if (abrir) {
      setCampos(estadoInicial(usuario));
      setNovaSenha("");
    }
  };

  const gerais = trocasGerais(
    usuario,
    campos,
    (chave) => cargos.find((o) => o.chave === chave)?.rotulo ?? chave,
  );
  const mudouAlgo = gerais.length > 0;
  const emailValido = EMAIL_VALIDO.test(campos.email.trim());
  const dadosValidos = campos.nome.trim().length > 0 && emailValido;

  const salvar = async () => {
    setGravando(true);
    const gravou = await aoGravar({
      nome: campos.nome.trim(),
      email: campos.email.trim(),
      papel: campos.papel,
      ativo: campos.ativo,
    });
    setGravando(false);
    if (gravou) abrirOuFechar(false);
  };

  const definirSenha = async () => {
    setGravando(true);
    if (await aoDefinirSenha(novaSenha)) setNovaSenha("");
    setGravando(false);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(novaSenha);
      setCopiado(true);
      setTimeout(() => {
        setCopiado(false);
      }, 1500);
    } catch {
      // Área de transferência indisponível (sem permissão): a senha continua visível no campo.
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label="Editar usuário"
          title="Editar usuário"
        >
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Editar {usuario.nome ?? usuario.email}</DialogTitle>
        </DialogHeader>
        {revisando ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Revise as alterações antes de salvar.
            </p>
            {gerais.length > 0 && (
              <div className="space-y-1.5">
                <div className="label-xs">Dados gerais</div>
                <div className="rounded-lg border border-border px-3 py-2">
                  {gerais.map((t) => (
                    <LinhaDeTroca key={t.rotulo} troca={t} />
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={gravando}
                onClick={() => {
                  setRevisando(false);
                }}
              >
                Voltar
              </Button>
              <Button disabled={gravando || !dadosValidos} onClick={() => void salvar()}>
                {gravando ? "Salvando..." : "Confirmar e salvar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Campo rotulo="Nome">
                <input
                  className={CAMPO}
                  value={campos.nome}
                  onChange={(e) => {
                    mudar({ nome: e.target.value });
                  }}
                />
              </Campo>
              <Campo
                rotulo="E-mail"
                ajuda="Alterar o e-mail muda o login do usuário."
                erro={!emailValido && campos.email.trim() ? "E-mail inválido." : null}
              >
                <input
                  type="email"
                  className={CAMPO}
                  value={campos.email}
                  onChange={(e) => {
                    mudar({ email: e.target.value });
                  }}
                />
              </Campo>
              <Campo rotulo="Cargo">
                <Escolha
                  opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.rotulo }))}
                  valor={campos.papel}
                  aoMudar={(papel) => {
                    mudar({ papel });
                  }}
                />
              </Campo>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <span className="text-[13px] font-medium">Usuário ativo</span>
                <Switch
                  aria-label="Usuário ativo"
                  checked={campos.ativo}
                  onCheckedChange={(ativo) => {
                    mudar({ ativo });
                  }}
                />
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-superficie p-4">
                <div className="label-xs flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-brand" aria-hidden />
                  Segurança · redefinir senha
                </div>
                <p className="text-xs text-muted-foreground">
                  Define uma nova senha na hora. O usuário entra imediatamente com ela e as sessões
                  abertas dele são encerradas.
                </p>
                <CampoDeSenha
                  rotulo="Nova senha"
                  valor={novaSenha}
                  aoMudar={setNovaSenha}
                  extra={
                    novaSenha && (
                      <BotaoDoCampo rotulo="Copiar senha" aoClicar={() => void copiar()}>
                        {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
                      </BotaoDoCampo>
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNovaSenha(gerarSenha());
                    }}
                  >
                    <RefreshCw aria-hidden />
                    Gerar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={novaSenha.length < 8 || gravando}
                    onClick={() => void definirSenha()}
                  >
                    {gravando ? "Definindo..." : "Definir nova senha"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  abrirOuFechar(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={mudouAlgo && !dadosValidos}
                onClick={() => {
                  if (mudouAlgo) setRevisando(true);
                  else abrirOuFechar(false);
                }}
              >
                {mudouAlgo ? "Revisar alterações" : "Fechar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinhaDeTroca({ troca }: { troca: Troca }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
      <span className="text-muted-foreground">{troca.rotulo}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground line-through">{troca.antes}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="font-medium">{troca.depois}</span>
      </span>
    </div>
  );
}
