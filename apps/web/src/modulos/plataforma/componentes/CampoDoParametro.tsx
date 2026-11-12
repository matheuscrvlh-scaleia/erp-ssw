import { CAMPO, Campo } from "@/componentes/comum/CamposDeFormulario";

/** Dica curta vai no placeholder; a longa (instrução) vai embaixo do campo, inteira. */
const DICA_LONGA = 40;

/** Um parâmetro de integração (empresa ou Plataforma). */
export function CampoDoParametro({
  rotulo,
  dica,
  valor,
  aoMudar,
}: {
  rotulo: string;
  dica?: string | undefined;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const longa = dica !== undefined && dica.length > DICA_LONGA;
  return (
    <Campo rotulo={rotulo} ajuda={longa ? dica : undefined}>
      <input
        className={CAMPO}
        placeholder={longa ? undefined : dica}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
      />
    </Campo>
  );
}
