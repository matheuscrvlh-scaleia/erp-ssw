import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Search } from "lucide-react";
import { cloneElement, type ReactElement, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

/** Peças das telas de Admin e Plataforma que o kit (componentes/comum) não tem. */

/**
 * Escrita com aviso: toast de sucesso ou do erro da API (já em português) e invalidação das
 * consultas afetadas. `gravar` devolve `false` em caso de erro, para o modal ficar aberto.
 */
export function useGravacao<E, S>(opcoes: {
  executar: (entrada: E) => Promise<S>;
  sucesso: string | ((entrada: E, saida: S) => string);
  invalidar: readonly QueryKey[];
  /** Depois do sucesso, com a resposta (ex.: abrir o que acabou de ser criado). */
  aoConcluir?: (saida: S) => void;
}) {
  const queryClient = useQueryClient();
  const mutacao = useMutation({ mutationFn: opcoes.executar });
  const gravar = async (entrada: E): Promise<boolean> => {
    try {
      const saida = await mutacao.mutateAsync(entrada);
      toast.success(
        typeof opcoes.sucesso === "string" ? opcoes.sucesso : opcoes.sucesso(entrada, saida),
      );
      await Promise.all(
        opcoes.invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      opcoes.aoConcluir?.(saida);
      return true;
    } catch (e) {
      toast.error(mensagemAmigavel(e));
      return false;
    }
  };
  return { gravar, gravando: mutacao.isPending };
}

/** Campo de formulário no desenho do `ui/input` (inputs e textarea feitos à mão). */
export const CAMPO =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-status-bad";

/** Props que o `Campo` repassa ao controle: liga rótulo, ajuda e erro ao leitor de tela. */
interface PropsDoControle {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Rótulo, controle (recebe o `id`), ajuda e erro logo abaixo (validação no próprio campo). */
export function Campo({
  rotulo,
  ajuda,
  erro,
  children,
}: {
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | null | undefined;
  children: ReactElement<PropsDoControle>;
}) {
  const id = useId();
  const idDaAjuda = `${id}-ajuda`;
  const idDoErro = `${id}-erro`;
  const descricao = [erro && idDoErro, ajuda && idDaAjuda].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {rotulo}
      </label>
      {cloneElement(children, {
        id,
        ...(descricao ? { "aria-describedby": descricao } : {}),
        ...(erro ? { "aria-invalid": true } : {}),
      })}
      {erro && (
        <p id={idDoErro} className="text-xs font-medium text-status-bad-fg">
          {erro}
        </p>
      )}
      {ajuda && (
        <p id={idDaAjuda} className="text-xs text-muted-foreground">
          {ajuda}
        </p>
      )}
    </div>
  );
}

export interface OpcaoDeEscolha {
  valor: string;
  rotulo: string;
}

/** O Radix não aceita item com valor "": a opção "nenhum" usa esta chave por dentro. */
const NENHUM = "__nenhum__";

/**
 * Escolha única (`ui/select`) a partir de uma lista. `vazio` vira a opção de valor "" ("Todos os
 * níveis", "Sem cargo"); sem ele, valor "" mostra o `placeholder`.
 */
export function Escolha({
  valor,
  aoMudar,
  opcoes,
  vazio,
  placeholder,
  rotulo,
  disabled,
  filtro,
  prefixo,
  className,
  ...controle
}: PropsDoControle & {
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: readonly OpcaoDeEscolha[];
  vazio?: string | undefined;
  placeholder?: string | undefined;
  /** Nome para o leitor de tela quando não há `<label>` (barra de filtros, célula de tabela). */
  rotulo?: string | undefined;
  disabled?: boolean | undefined;
  /** Desenho da barra de filtros (cartão com sombra, como os outros filtros). */
  filtro?: boolean | undefined;
  /** Nome do filtro antes do valor, quando o valor sozinho é ambíguo ("Penaliza · Todos"). */
  prefixo?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Select
      value={valor === "" && vazio ? NENHUM : valor}
      onValueChange={(v) => {
        aoMudar(v === NENHUM ? "" : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        {...controle}
        aria-label={rotulo}
        className={cn(
          "text-[13px] aria-invalid:border-status-bad",
          filtro && "w-auto min-w-[180px] gap-2 border-border font-medium shadow-cartao",
          className,
        )}
      >
        {prefixo ? (
          <span className="min-w-0">
            <span className="mr-1.5 font-medium text-muted-foreground">{prefixo}</span>
            <SelectValue placeholder={placeholder ?? vazio} />
          </span>
        ) : (
          <SelectValue placeholder={placeholder ?? vazio} />
        )}
      </SelectTrigger>
      <SelectContent>
        {vazio && (
          <SelectItem value={NENHUM} className="text-[13px]">
            {vazio}
          </SelectItem>
        )}
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor} className="text-[13px]">
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Opções a partir de um mapa `chave → rótulo` (ex.: `ROTULO_DA_ENTIDADE`). */
export const opcoesDoMapa = (mapa: Record<string, string>): OpcaoDeEscolha[] =>
  Object.entries(mapa).map(([valor, rotulo]) => ({ valor, rotulo }));

/** Busca de texto da barra de filtros (lupa, 36 px, mesmo desenho dos outros filtros). */
export function BuscaNaBarra({
  valor,
  aoMudar,
  rotulo,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  rotulo: string;
  placeholder: string;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        aria-label={rotulo}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        className={cn(CAMPO, "border-border pl-9 shadow-cartao")}
      />
    </div>
  );
}

/** Senha com botão de mostrar/ocultar; `extra` entra ao lado do olho (ex.: copiar). */
export function CampoDeSenha({
  rotulo,
  valor,
  aoMudar,
  extra,
  erro,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  extra?: ReactNode;
  erro?: string | null | undefined;
}) {
  const id = useId();
  const [ver, setVer] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={cn(CAMPO, "pr-20")}
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value);
          }}
        />
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
          {extra}
          <BotaoDoCampo
            rotulo={ver ? "Ocultar senha" : "Mostrar senha"}
            aoClicar={() => {
              setVer((v) => !v);
            }}
          >
            {ver ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </BotaoDoCampo>
        </div>
      </div>
      {erro && (
        <p id={`${id}-erro`} className="text-xs font-medium text-status-bad-fg">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Botão de ícone dentro de um campo (mostrar senha, copiar): 28 px, com dica. */
export function BotaoDoCampo({
  rotulo,
  aoClicar,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </button>
  );
}
