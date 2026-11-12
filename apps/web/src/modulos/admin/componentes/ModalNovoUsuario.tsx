import { type NovoUsuario, novoUsuario } from "@erp/shared/contratos/admin";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { Abas } from "@/componentes/comum/Abas";
import { CAMPO, Campo, CampoDeSenha, Escolha } from "@/componentes/comum/CamposDeFormulario";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";

export interface Opcao {
  chave: string;
  rotulo: string;
}

type Modo = NovoUsuario["modo"];

const VAZIO = { nome: "", email: "", senha: "", papel: "operador" };

/**
 * Novo usuário: convite por e-mail (a pessoa cria a senha pelo link) ou conta já com senha. O
 * acesso vem do cargo; exceções, depois, em "Permissões".
 */
export function ModalNovoUsuario({
  cargos,
  aoGravar,
}: {
  cargos: readonly Opcao[];
  /** `false` quando não gravou: o modal fica aberto com o que foi digitado. */
  aoGravar: (novo: NovoUsuario) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("convite");
  const [campos, setCampos] = useState(VAZIO);
  const [gravando, setGravando] = useState(false);

  const mudar = (parte: Partial<typeof VAZIO>) => {
    setCampos((c) => ({ ...c, ...parte }));
  };
  const lido = novoUsuario.safeParse({
    modo,
    nome: campos.nome,
    email: campos.email,
    papel: campos.papel,
    ...(modo === "senha" ? { senha: campos.senha } : {}),
  });

  /** Erro do campo já preenchido (o vazio só desabilita o botão, sem acusar). */
  const erroDe = (campo: "email" | "senha", digitado: string) =>
    lido.success || !digitado.trim()
      ? null
      : (lido.error.issues.find((i) => i.path[0] === campo)?.message ?? null);

  const abrirOuFechar = (abrir: boolean) => {
    setAberto(abrir);
    if (!abrir) {
      setCampos(VAZIO);
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

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
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
        <p className="text-[12.5px] text-muted-foreground">
          {modo === "convite"
            ? "Enviamos um link de convite. O usuário define a própria senha ao acessar."
            : "O usuário poderá entrar imediatamente com este e-mail e senha. Recomende que troque a senha no primeiro acesso."}
        </p>
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
          <Campo rotulo="E-mail" erro={erroDe("email", campos.email)}>
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
              erro={erroDe("senha", campos.senha)}
              valor={campos.senha}
              aoMudar={(senha) => {
                mudar({ senha });
              }}
            />
          )}
          <Campo
            rotulo="Cargo"
            ajuda="O cargo define o que a pessoa vê e faz. Exceções individuais ficam em “Permissões”."
          >
            <Escolha
              opcoes={cargos.map((c) => ({ valor: c.chave, rotulo: c.rotulo }))}
              valor={campos.papel}
              aoMudar={(papel) => {
                mudar({ papel });
              }}
            />
          </Campo>
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
