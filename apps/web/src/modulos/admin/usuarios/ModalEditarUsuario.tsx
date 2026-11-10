import { ROTULO_DA_TELA } from "@erp/shared/acesso/telas";
import { type EntradaDe } from "@erp/shared/contrato";
import { type contratosAdmin, type UsuarioDaEmpresa } from "@erp/shared/contratos/admin";
import { ArrowRight, Check, Copy, KeyRound, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";

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

import { CAMPO, Campo, CampoDeSenha } from "../comum";
import { EditorDeExcecoes } from "../EditorDeTelas";
import {
  listaDasExcecoes,
  mapaDasExcecoes,
  type MapaDeExcecoes,
  type Troca,
  trocasDeExcecao,
} from "../telas";
import { type Opcao } from "./ModalNovoUsuario";

export type AlteracaoDeUsuario = EntradaDe<typeof contratosAdmin.alterarUsuario>;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Senha forte gerada no navegador (16 caracteres, sem os ambíguos 0/O/1/l/I). */
export function gerarSenha(): string {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const sorteio = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(sorteio, (n) => caracteres[n % caracteres.length]).join("");
}

function estadoInicial(u: UsuarioDaEmpresa) {
  return {
    nome: u.nome ?? "",
    email: u.email,
    departamento: u.departamento ?? "",
    papel: u.papel ?? "operador",
    ativo: u.ativo,
  };
}

/** Dados gerais alterados, para a revisão antes de salvar. */
function trocasGerais(
  u: UsuarioDaEmpresa,
  e: ReturnType<typeof estadoInicial>,
  rotulos: { cargo: (c: string) => string; departamento: (d: string) => string },
): Troca[] {
  const trocas: Troca[] = [];
  const comparar = (rotulo: string, antes: string, depois: string) => {
    if (antes !== depois) trocas.push({ rotulo, antes: antes || "—", depois: depois || "—" });
  };
  comparar("Nome", u.nome ?? "", e.nome.trim());
  comparar("E-mail", u.email, e.email.trim().toLowerCase());
  comparar(
    "Departamento",
    u.departamento ? rotulos.departamento(u.departamento) : "",
    e.departamento ? rotulos.departamento(e.departamento) : "",
  );
  comparar("Nível", u.papel ? rotulos.cargo(u.papel) : "", rotulos.cargo(e.papel));
  comparar("Status", u.ativo ? "Ativo" : "Inativo", e.ativo ? "Ativo" : "Inativo");
  return trocas;
}

export function ModalEditarUsuario({
  usuario,
  cargos,
  departamentos,
  aoGravar,
  aoDefinirSenha,
}: {
  usuario: UsuarioDaEmpresa;
  cargos: readonly Opcao[];
  departamentos: readonly Opcao[];
  aoGravar: (dados: AlteracaoDeUsuario) => Promise<boolean>;
  aoDefinirSenha: (senha: string) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [campos, setCampos] = useState(() => estadoInicial(usuario));
  const [excecoes, setExcecoes] = useState<MapaDeExcecoes>(() => mapaDasExcecoes(usuario.excecoes));
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
      setExcecoes(mapaDasExcecoes(usuario.excecoes));
      setNovaSenha("");
    }
  };

  const rotuloDe = (lista: readonly Opcao[]) => (chave: string) =>
    lista.find((o) => o.chave === chave)?.rotulo ?? chave;
  const gerais = trocasGerais(usuario, campos, {
    cargo: rotuloDe(cargos),
    departamento: rotuloDe(departamentos),
  });
  const porCategoria = trocasDeExcecao(
    mapaDasExcecoes(usuario.excecoes),
    excecoes,
    (t) => ROTULO_DA_TELA[t],
  );
  const mudouAlgo = gerais.length > 0 || porCategoria.length > 0;
  const emailValido = EMAIL_VALIDO.test(campos.email.trim());
  const dadosValidos = campos.nome.trim().length > 0 && emailValido;

  const salvar = async () => {
    setGravando(true);
    const gravou = await aoGravar({
      nome: campos.nome.trim(),
      email: campos.email.trim(),
      papel: campos.papel,
      departamento: campos.departamento || null,
      ativo: campos.ativo,
      excecoes: listaDasExcecoes(excecoes),
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
        <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Editar usuário">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Editar {usuario.nome ?? usuario.email}</DialogTitle>
        </DialogHeader>
        {revisando ? (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Revise as alterações antes de salvar.
            </p>
            {gerais.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wider">Dados gerais</div>
                <div className="rounded-md border border-border/60 p-2">
                  {gerais.map((t) => (
                    <LinhaDeTroca key={t.rotulo} troca={t} />
                  ))}
                </div>
              </div>
            )}
            {porCategoria.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wider">
                  Permissões por categoria
                </div>
                {porCategoria.map((c) => (
                  <div key={c.chave} className="rounded-md border border-border/60 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-[11px] font-medium uppercase tracking-wider">
                        {c.rotulo}
                      </div>
                      <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                        {c.trocas.length} alteraç{c.trocas.length === 1 ? "ão" : "ões"}
                      </span>
                    </div>
                    {c.trocas.map((t) => (
                      <LinhaDeTroca key={t.tela} troca={t} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              gerais.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Nenhuma alteração nas permissões.
                </p>
              )
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
            <div className="space-y-3">
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
              <Campo rotulo="Departamento">
                <select
                  className={CAMPO}
                  value={campos.departamento}
                  onChange={(e) => {
                    mudar({ departamento: e.target.value });
                  }}
                >
                  <option value="">Sem departamento</option>
                  {departamentos.map((d) => (
                    <option key={d.chave} value={d.chave}>
                      {d.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Nível">
                <select
                  className={CAMPO}
                  value={campos.papel}
                  onChange={(e) => {
                    mudar({ papel: e.target.value });
                  }}
                >
                  {cargos.map((c) => (
                    <option key={c.chave} value={c.chave}>
                      {c.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <span className="text-[13px] font-medium">Usuário ativo</span>
                <Switch
                  aria-label="Usuário ativo"
                  checked={campos.ativo}
                  onCheckedChange={(ativo) => {
                    mudar({ ativo });
                  }}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  Segurança · redefinir senha
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Define uma nova senha na hora. O usuário entra imediatamente com ela e as sessões
                  abertas dele são encerradas.
                </p>
                <CampoDeSenha
                  rotulo="Nova senha"
                  valor={novaSenha}
                  aoMudar={setNovaSenha}
                  extra={
                    novaSenha && (
                      <button
                        type="button"
                        onClick={() => void copiar()}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Copiar senha"
                        title="Copiar senha"
                      >
                        {copiado ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[12px]"
                    onClick={() => {
                      setNovaSenha(gerarSenha());
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-[12px]"
                    disabled={novaSenha.length < 8 || gravando}
                    onClick={() => void definirSenha()}
                  >
                    {gravando ? "Definindo..." : "Definir nova senha"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Telas (override)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Vazio = padrão do role/setor. Marcar libera, desmarcar bloqueia.
                </p>
                <EditorDeExcecoes excecoes={excecoes} aoMudar={setExcecoes} />
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
    <div className="flex items-center justify-between py-0.5 text-[12px]">
      <span className="text-muted-foreground">{troca.rotulo}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground line-through">{troca.antes}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{troca.depois}</span>
      </span>
    </div>
  );
}
