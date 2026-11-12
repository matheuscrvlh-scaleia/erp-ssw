import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEncerrarPorInatividade } from "./inatividade";

function Painel({ aoEncerrar }: { aoEncerrar: () => void }) {
  useEncerrarPorInatividade(aoEncerrar);
  return null;
}

const MINUTO = 60_000;

describe("useEncerrarPorInatividade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("encerra uma vez após 30 min sem uso", () => {
    const aoEncerrar = vi.fn();
    render(<Painel aoEncerrar={aoEncerrar} />);
    act(() => {
      vi.advanceTimersByTime(29 * MINUTO);
    });
    expect(aoEncerrar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3 * MINUTO);
    });
    expect(aoEncerrar).toHaveBeenCalledTimes(1);
  });

  it("uso (nesta ou em outra aba) adia o encerramento", () => {
    const aoEncerrar = vi.fn();
    render(<Painel aoEncerrar={aoEncerrar} />);
    act(() => {
      vi.advanceTimersByTime(20 * MINUTO);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    act(() => {
      vi.advanceTimersByTime(20 * MINUTO);
    });
    window.localStorage.setItem("painel:ultima-atividade", String(Date.now()));
    act(() => {
      vi.advanceTimersByTime(20 * MINUTO);
    });
    expect(aoEncerrar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(11 * MINUTO);
    });
    expect(aoEncerrar).toHaveBeenCalledTimes(1);
  });
});
