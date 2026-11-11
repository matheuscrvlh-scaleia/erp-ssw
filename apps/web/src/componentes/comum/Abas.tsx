import { type ReactNode } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/componentes/ui/tabs";

interface AbaDaLista<T extends string> {
  valor: T;
  rotulo: ReactNode;
}

/**
 * Abas controladas (Tabs do shadcn): setas do teclado trocam de aba; a tela mostra o conteúdo
 * pelo `valor` (cada aba só consulta quando aberta). Vai no slot `abas` do `Pagina` quando troca
 * o conteúdo da tela inteira.
 */
export function Abas<T extends string>({
  abas,
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  abas: readonly AbaDaLista<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  /** Nome da lista para o leitor de tela (ex.: "Abas do Romaneio"). */
  rotulo?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Tabs
      value={valor}
      onValueChange={(escolhida) => {
        const aba = abas.find((a) => a.valor === escolhida);
        if (aba) aoMudar(aba.valor);
      }}
    >
      <TabsList aria-label={rotulo} className={className}>
        {abas.map((a) => (
          <TabsTrigger key={a.valor} value={a.valor}>
            {a.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
