import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { rotulosDosRecortes } from "../busca";
import { SeletorDeRecorte } from "./SeletorDeRecorte";

afterEach(cleanup);

describe("SeletorDeRecorte", () => {
  it("marca na hora e só avisa a tela ao fechar, com a lista inteira", () => {
    const aoMudar = vi.fn();
    render(
      <SeletorDeRecorte
        rotulos={rotulosDosRecortes("ACME")}
        selecionados={["emitidos"]}
        aoMudar={aoMudar}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Recorte CT-e emitidos" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "CT-e atrasados" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Em atraso (ACME)" }));
    expect(aoMudar).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith(["atrasados", "em_atraso_fr"]);
  });

  it("'limpar' volta para emitidos na hora", () => {
    const aoMudar = vi.fn();
    render(
      <SeletorDeRecorte
        rotulos={rotulosDosRecortes("ACME")}
        selecionados={["atrasados", "sem_movimento"]}
        aoMudar={aoMudar}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2 recortes/ }));
    fireEvent.click(screen.getByRole("button", { name: "limpar" }));
    expect(aoMudar).toHaveBeenCalledWith(["emitidos"]);
  });
});
