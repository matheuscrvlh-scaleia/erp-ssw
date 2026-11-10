import { CATEGORIAS_DE_TELA } from "@erp/shared/acesso/editor-de-telas";
import { type NovoUsuario, novoUsuario } from "@erp/shared/contratos/admin";
import { UserPlus } from "lucide-react";
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

import { Abas, CAMPO, Campo, CampoDeSenha } from "../comum";
import { EditorDeExcecoes } from "../EditorDeTelas";
import { listaDasExcecoes, type MapaDeExcecoes } from "../telas";

export interface Opcao {
  chave: string;
  rotulo: string;
}

type Modo = NovoUsuario["modo"];

const VAZIO = { nome: "", email: "", senha: "", departamento: "", papel: "operador" };

/** Novo usuário: convite por e-mail (a pessoa cria a senha pelo link) ou conta já com senha. */
export function ModalNovoUsuario({
  cargos,
  departamentos,
  aoGravar,
}: {
  cargos: readonly Opcao[];
  departamentos: readonly Opcao[];
  /** `false` quando não gravou: o modal fica aberto com o que foi digitado. */
  aoGravar: (novo: NovoUsuario) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("convite");
  const [campos, setCampos] = useState(VAZIO);
  const [excecoes, setExcecoes] = useState<MapaDeExcecoes>({});
  const [gravando, setGravando] = useState(false);

  const mudar = (parte: Partial<typeof VAZIO>) => {
    setCampos((c) => ({ ...c, ...parte }));
  };
  const lido = novoUsuario.safeParse({
    modo,
    nome: campos.nome,
    email: campos.email,
    papel: campos.papel,
    departamento: campos.departamento || null,
    excecoes: listaDasExcecoes(excecoes),
    ...(modo === "senha" ? { senha: campos.senha } : {}),
  });

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (!abrir) {
      setCampos(VAZIO);
      setExcecoes({});
      setModo("convite");
    }
  };

  const gravar = async () => {
    if (!lido.success) return;
    setGravando(true);
    const gravou = await aoGravar(lido.data);
    setGravando(false);
    if (gravou) abrirOuFechar(false);
  };

  const todasAsTelas = CATEGORIAS_DE_TELA.flatMap((c) => c.telas);
  const operacionais = CATEGORIAS_DE_TELA.find((c) => c.chave === "operacional")?.telas ?? [];

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <Abas
          className="grid w-full grid-cols-2"
          abas={[
            { valor: "convite", rotulo: "Convidar por e-mail" },
            { valor: "senha", rotulo: "Criar com senha" },
          ]}
          valor={modo}
          aoMudar={setModo}
        />
        <p className="text-[11px] text-muted-foreground">
          {modo === "convite"
            ? "Enviamos um link de convite. O usuário define a própria senha ao acessar."
            : "O usuário poderá entrar imediatamente com este e-mail e senha. Recomende que troque a senha no primeiro acesso."}
        </p>
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
          <Campo rotulo="E-mail">
            <input
              type="email"
              className={CAMPO}
              value={campos.email}
              onChange={(e) => {
                mudar({ email: e.target.value });
              }}
            />
          </Campo>
          {modo === "senha" && (
            <CampoDeSenha
              rotulo="Senha"
              valor={campos.senha}
              aoMudar={(senha) => {
                mudar({ senha });
              }}
            />
          )}
          <Campo
            rotulo="Departamento"
            ajuda="O departamento já libera um conjunto de módulos. Gerencie em Admin · Departamentos."
          >
            <select
              className={CAMPO}
              value={campos.departamento}
              onChange={(e) => {
                mudar({ departamento: e.target.value });
              }}
            >
              <option value="">Selecionar...</option>
              {departamentos.map((d) => (
                <option key={d.chave} value={d.chave}>
                  {d.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Nível de acesso">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Acesso aos módulos
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setExcecoes({});
                  }}
                >
                  Padrão
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setExcecoes(Object.fromEntries(operacionais.map((t) => [t, true])));
                  }}
                >
                  Liberar operacional
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setExcecoes(Object.fromEntries(todasAsTelas.map((t) => [t, false])));
                  }}
                >
                  Bloquear tudo
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vazio = padrão do role/setor. Telas administrativas só liberam se o nível for admin.
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
          <Button disabled={gravando || !lido.success} onClick={() => void gravar()}>
            {gravando
              ? modo === "senha"
                ? "Criando..."
                : "Enviando..."
              : modo === "senha"
                ? "Criar usuário"
                : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
