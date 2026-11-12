import { Aviso } from "@/componentes/comum/Aviso";

/** Aviso quando há filtro de código ativo (prejuízo atribuído). */
export function AtribuicaoLegenda({ codigos }: { codigos?: readonly number[] | undefined }) {
  if (!codigos || codigos.length === 0) return null;
  return (
    <Aviso tom="info">
      Prejuízo atribuído ao(s) código(s) selecionado(s): {codigos.map((c) => `#${c}`).join(", ")} —
      conta apenas os CT-e cuja ocorrência penalizante é um desses códigos.
    </Aviso>
  );
}
