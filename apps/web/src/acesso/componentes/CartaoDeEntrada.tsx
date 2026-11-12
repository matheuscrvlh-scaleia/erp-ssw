import { type ReactNode, useEffect } from "react";

import { aplicarPaleta, ultimaCorDaMarca } from "@/acesso/marca";

import { IlustracaoLogistica } from "./IlustracaoLogistica";

/**
 * Moldura das telas fora do painel (login, nova senha, convite), no desenho de
 * mockups/login.png, em tela cheia: ilustração à esquerda e o formulário à direita. A cor é a
 * da última empresa usada neste navegador (antes do login não se sabe a empresa).
 */
export function CartaoDeEntrada({
  titulo,
  subtitulo,
  aviso,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo: string;
  aviso?: ReactNode;
  /** Linha no pé do formulário (ex.: "Sem conta? Peça um convite…"). */
  rodape?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => aplicarPaleta(ultimaCorDaMarca()), []);

  return (
    <div className="grid min-h-screen w-full bg-card lg:grid-cols-[1.35fr_1fr]">
      <div
        aria-hidden
        className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-superficie to-muted p-10 lg:flex"
      >
        <IlustracaoLogistica className="h-auto w-full max-w-[760px]" />
      </div>
      <div className="flex justify-center px-6 py-10 sm:px-12 lg:border-l lg:border-border">
        <div className="flex w-full max-w-[440px] flex-col">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">
              BI
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Painel BI</span>
          </div>
          <div className="flex flex-1 flex-col justify-center py-10">
            {aviso}
            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-foreground">
              {titulo}
            </h1>
            <p className="mt-2 mb-8 text-[13.5px] text-muted-foreground">{subtitulo}</p>
            {children}
          </div>
          {rodape && <div className="text-[13px] text-muted-foreground">{rodape}</div>}
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

/** Campo do login: fundo cinza sem borda, como no mockup. */
export const CLASSE_CAMPO_DE_ENTRADA =
  "h-12 rounded-md border-transparent bg-campo px-4 text-[14px] shadow-none focus-visible:border-primary focus-visible:bg-card";
