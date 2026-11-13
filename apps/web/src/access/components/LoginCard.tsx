import { type ReactNode, useEffect, useLayoutEffect } from "react";

import { aplicarPaleta, ultimaCorDaMarca } from "@/access/brand";
import { forcarTemaClaro } from "@/lib/theme";

import { IlustracaoLogistica, PisoIsometrico } from "./LogisticsIllustration";

/**
 * Moldura das telas fora do painel (login, nova senha, convite), no desenho de
 * mockups/login.png, em tela cheia: o piso de placas cobre a tela, a ilustração fica à esquerda e o
 * formulário à direita num painel translúcido (o piso aparece por baixo). A cor é a
 * da última empresa usada neste navegador (antes do login não se sabe a empresa).
 */
export function CartaoDeEntrada({
  titulo,
  subtitulo,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo: string;
  /** Linha no pé do formulário (ex.: "Sem conta? Peça um convite…"). */
  rodape?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => aplicarPaleta(ultimaCorDaMarca()), []);
  // As telas de entrada são sempre claras, mesmo com o painel no escuro.
  useLayoutEffect(forcarTemaClaro, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <PisoIsometrico className="absolute inset-0 h-full w-full" />
      <div className="relative grid min-h-screen lg:grid-cols-[1.35fr_1fr]">
        <div aria-hidden className="hidden items-center justify-center p-10 lg:flex">
          <IlustracaoLogistica className="h-auto w-full max-w-[1000px]" />
        </div>
        <div className="flex justify-center bg-card/80 px-6 py-10 backdrop-blur-[3px] sm:px-12 lg:border-l lg:border-card/80 [&_button]:rounded-none [&_input]:rounded-none">
          <div className="flex w-full max-w-[420px] flex-col">
            <span className="text-[16px] font-semibold tracking-tight text-foreground">
              Copiloto SSW
            </span>
            <div className="flex flex-1 flex-col justify-center py-10">
              <h1 className="text-[30px] leading-tight font-normal tracking-[-0.01em] text-foreground">
                {titulo}
              </h1>
              <p className="mt-2 mb-9 text-[13px] text-muted-foreground">{subtitulo}</p>
              {children}
            </div>
            {rodape && <div className="text-[12.5px] text-muted-foreground">{rodape}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErroDoCampo({ mensagem }: { mensagem: string | undefined }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12px] text-destructive">
      {mensagem}
    </p>
  );
}

/** Campo do login: fundo cinza sem borda, quadrado como no mockup. */
export const CLASSE_CAMPO_DE_ENTRADA =
  "h-12 border-transparent bg-campo px-4 text-[14px] shadow-none focus-visible:border-primary focus-visible:bg-card";
