import { type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/componentes/ui/tabs";

export interface AbaDaLista<T extends string> {
  valor: T;
  rotulo: ReactNode;
}

interface AbasProps<T extends string> {
  abas: readonly AbaDaLista<T>[];
  /** Controlada (estado da tela ou da URL). Sem `valor`, começa em `padrao` e se cuida sozinha. */
  valor?: T | undefined;
  padrao?: T | undefined;
  aoMudar?: ((valor: T) => void) | undefined;
  /** Nome da lista para o leitor de tela (ex.: "Abas do Romaneio"). */
  rotulo?: string | undefined;
  /** Classes da lista de abas. */
  className?: string | undefined;
  /** Classes de cada aba (ex.: "text-[12px]"). */
  classeDaAba?: string | undefined;
  /** Classes do bloco que envolve a lista e os conteúdos. */
  classeDoGrupo?: string | undefined;
  /** `ConteudoDaAba` de cada aba; sem eles, quem usa mostra o conteúdo pelo `valor`. */
  children?: ReactNode;
}

/**
 * Abas (Tabs do shadcn): setas do teclado trocam de aba, e o conteúdo da aba fechada sai da
 * tela (cada aba só consulta quando aberta).
 */
export function Abas<T extends string>({
  abas,
  valor,
  padrao,
  aoMudar,
  rotulo,
  className,
  classeDaAba,
  classeDoGrupo,
  children,
}: AbasProps<T>) {
  const controle =
    valor === undefined ? { defaultValue: padrao ?? abas[0]?.valor } : { value: valor };
  return (
    <Tabs
      {...controle}
      onValueChange={(escolhida) => {
        const aba = abas.find((a) => a.valor === escolhida);
        if (aba) aoMudar?.(aba.valor);
      }}
      className={classeDoGrupo}
    >
      <TabsList aria-label={rotulo} className={className}>
        {abas.map((a) => (
          <TabsTrigger key={a.valor} value={a.valor} className={classeDaAba}>
            {a.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export function ConteudoDaAba({
  valor,
  className,
  children,
}: {
  valor: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <TabsContent value={valor} className={className}>
      {children}
    </TabsContent>
  );
}
