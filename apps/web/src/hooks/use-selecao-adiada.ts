import { useCallback, useEffect, useRef, useState } from "react";

/** Espera entre o último clique num filtro de múltipla escolha e a consulta. */
export const ATRASO_DO_FILTRO_MS = 600;

/**
 * Seleção de múltipla escolha com propagação adiada: o clique marca na hora (rascunho), mas
 * `aoMudar` (que muda a URL e, com ela, todas as consultas da tela) só roda depois de uma pausa
 * ou quando o seletor fecha (`aplicar`). Marcar 5 unidades seguidas = um lote de consultas, não 5.
 * Mudança vinda de fora ("Limpar filtros") atualiza o rascunho se não houver clique pendente; ao
 * desmontar, o pendente é descartado (aplicar ali navegaria de volta à tela deixada).
 * origem: src/hooks/use-selecao-adiada.ts (sistema atual)
 */
export function useSelecaoAdiada<T extends string | number>(
  selecionados: readonly T[],
  aoMudar: (valores: T[]) => void,
  atraso = ATRASO_DO_FILTRO_MS,
) {
  const [rascunho, setRascunho] = useState<T[]>([...selecionados]);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<T[] | null>(null);
  const aoMudarAtual = useRef(aoMudar);
  useEffect(() => {
    aoMudarAtual.current = aoMudar;
  }, [aoMudar]);

  // A lista costuma ser um array novo a cada render: compara pelo conteúdo (ajuste de estado
  // durante o render, o padrão do React para "estado que segue a prop").
  const chave = selecionados.join("\u0001");
  const [chaveVista, setChaveVista] = useState(chave);
  if (chaveVista !== chave) {
    setChaveVista(chave);
    if (pendente.current === null) setRascunho([...selecionados]);
  }

  const aplicar = useCallback(() => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    const valores = pendente.current;
    pendente.current = null;
    if (valores) aoMudarAtual.current(valores);
  }, []);

  /** Muda o rascunho e agenda a propagação; `imediato` aplica na hora (ex.: "limpar"). */
  const alterar = useCallback(
    (valores: T[], imediato = false) => {
      setRascunho(valores);
      pendente.current = valores;
      if (relogio.current) clearTimeout(relogio.current);
      if (imediato) aplicar();
      else relogio.current = setTimeout(aplicar, atraso);
    },
    [aplicar, atraso],
  );

  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
    },
    [],
  );

  return { selecionados: rascunho, alterar, aplicar };
}
