import { useCallback, useEffect, useRef, useState } from "react";

/** Espera entre o último clique num filtro de múltipla escolha e a consulta. */
export const ATRASO_FILTRO_MS = 600;

/**
 * Seleção de filtro de múltipla escolha com propagação adiada. O item marca na hora (rascunho),
 * mas `aoMudar` — que muda a URL e, com ela, as consultas da tela — só roda depois de `atraso` ms
 * sem novo clique, ou quando o seletor fecha (`aplicar`): marcar 5 unidades seguidas dispara um
 * lote de consultas, não cinco. Mudança vinda de fora ("Limpar filtros") atualiza o rascunho se
 * não houver clique pendente. Ao desmontar, o pendente é descartado (aplicar ali poderia navegar
 * de volta para a tela que o usuário acabou de deixar). origem: hooks/use-selecao-adiada.ts
 */
export function useSelecaoAdiada<T extends string | number>(
  selecionados: readonly T[],
  aoMudar: (valores: T[]) => void,
  atraso = ATRASO_FILTRO_MS,
) {
  const [rascunho, setRascunho] = useState<readonly T[]>(selecionados);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<T[] | null>(null);
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  // `selecionados` costuma ser um array novo a cada render: compara pelo conteúdo.
  const [chaveAnterior, setChaveAnterior] = useState(selecionados.join("\u0001"));
  const chave = selecionados.join("\u0001");
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    if (pendente.current === null) setRascunho(selecionados);
  }

  const aplicar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const valores = pendente.current;
    pendente.current = null;
    if (valores) aoMudarRef.current(valores);
  }, []);

  /** Atualiza o rascunho e agenda a propagação; `imediato` aplica na hora (ex.: "limpar"). */
  const alterar = useCallback(
    (proximos: T[], imediato = false) => {
      setRascunho(proximos);
      pendente.current = proximos;
      if (timer.current) clearTimeout(timer.current);
      if (imediato) aplicar();
      else timer.current = setTimeout(aplicar, atraso);
    },
    [aplicar, atraso],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { selecionados: rascunho, alterar, aplicar };
}
