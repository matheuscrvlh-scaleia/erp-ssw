import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { type AbaDoHub, abasVisiveis } from "@/acesso/navegacao";
import { consultaAcesso } from "@/acesso/sessao";
import { Abas } from "@/componentes/comum/Abas";
import { Alternador } from "@/componentes/comum/Alternador";

import { ProvedorDoHub } from "./Pagina";

/** `?aba=` das telas com abas: texto livre; aba que não existe ou não é do usuário cai na primeira. */
export function buscaDoHub(bruto: Record<string, unknown>): { aba?: string | undefined } {
  return typeof bruto["aba"] === "string" ? { aba: bruto["aba"] } : {};
}

/** Abas que o usuário vê e a aberta (a da URL, ou a primeira que ele vê). */
export function useAbasDoHub(abas: readonly AbaDoHub[], aba: string | undefined) {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const visiveis = abasVisiveis({ abas }, acesso);
  return { visiveis, atual: visiveis.find((a) => a.valor === aba) ?? visiveis[0] };
}

const chave = (a: AbaDoHub) => a.grupo ?? a.valor;

/**
 * Tela com abas (hub): cada aba é uma página inteira (`<Pagina>` da tela de antes, sem
 * duplicar), com o título e as abas do hub no cabeçalho. Abas do mesmo grupo viram uma aba só,
 * com um alternador logo abaixo do cabeçalho. Só a aba aberta é montada (e consulta).
 */
export function HubDeAbas({
  titulo,
  rotulo,
  visiveis,
  atual,
  aoMudar,
  acoes,
  meta,
  children,
}: {
  titulo: ReactNode;
  /** Nome da lista de abas para o leitor de tela. */
  rotulo: string;
  visiveis: readonly AbaDoHub[];
  atual: AbaDoHub | undefined;
  aoMudar: (aba: string) => void;
  acoes?: ReactNode;
  meta?: ReactNode;
  children: (aba: AbaDoHub) => ReactNode;
}) {
  if (!atual) return null;
  const grupos = [...new Map(visiveis.map((a) => [chave(a), a.grupo ?? a.rotulo])).entries()];
  const irmas = visiveis.filter((a) => chave(a) === chave(atual));
  return (
    <ProvedorDoHub
      cabecalho={{
        titulo,
        acoes,
        meta,
        abas: (
          // Muitas abas não cabem no celular: a lista rola na horizontal em vez de estourar a página.
          <div className="rolagem-fina max-w-full overflow-x-auto pb-1">
            <Abas
              abas={grupos.map(([valor, r]) => ({ valor, rotulo: r }))}
              valor={chave(atual)}
              aoMudar={(g) => {
                const primeira = visiveis.find((a) => chave(a) === g);
                if (primeira) aoMudar(primeira.valor);
              }}
              rotulo={rotulo}
              className="w-max"
            />
          </div>
        ),
        subAbas: irmas.length > 1 && (
          <div className="rolagem-fina max-w-full overflow-x-auto">
            <Alternador
              opcoes={irmas.map((a) => ({ valor: a.valor, rotulo: a.rotulo }))}
              valor={atual.valor}
              aoMudar={aoMudar}
              rotulo={atual.grupo ?? atual.rotulo}
              tamanho="pequeno"
            />
          </div>
        ),
      }}
    >
      {children(atual)}
    </ProvedorDoHub>
  );
}
