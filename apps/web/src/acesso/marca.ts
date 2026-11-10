import { type EmpresaAtiva } from "@erp/shared/contratos/auth";
import { useEffect } from "react";

/** Cor do tema em styles.css (e padrão de `empresas.cor_primaria`). */
const COR_DO_TEMA = "#212a63";

export const TITULO_PADRAO = "Painel Logístico";

/**
 * Variáveis CSS da marca da empresa ativa. Com a cor do tema (caso da FR) nada é sobrescrito: o
 * styles.css continua valendo inteiro, inclusive o tom de destaque do menu ajustado à mão.
 */
export function variaveisDaMarca(corPrimaria: string | undefined): Record<string, string> {
  const cor = corPrimaria?.toLowerCase();
  if (!cor || cor === COR_DO_TEMA || !/^#[0-9a-f]{6}$/.test(cor)) return {};
  return {
    "--sidebar": cor,
    "--sidebar-primary-foreground": cor,
    "--sidebar-accent": `color-mix(in srgb, ${cor} 85%, white)`,
    "--marca-primaria": cor,
  };
}

export function tituloComEmpresa(nomeEmpresa: string | undefined): string {
  return nomeEmpresa ? `${nomeEmpresa} · ${TITULO_PADRAO}` : TITULO_PADRAO;
}

/** Cores da barra lateral e do topo, e título da aba, conforme a empresa ativa. */
export function useMarcaDaEmpresa(empresa: EmpresaAtiva | null): void {
  const cor = empresa?.corPrimaria;
  const nome = empresa?.nome;
  useEffect(() => {
    const raiz = document.documentElement.style;
    const variaveis = Object.entries(variaveisDaMarca(cor));
    for (const [nomeDaVariavel, valor] of variaveis) raiz.setProperty(nomeDaVariavel, valor);
    return () => {
      for (const [nomeDaVariavel] of variaveis) raiz.removeProperty(nomeDaVariavel);
    };
  }, [cor]);
  useEffect(() => {
    document.title = tituloComEmpresa(nome);
    return () => {
      document.title = TITULO_PADRAO;
    };
  }, [nome]);
}
