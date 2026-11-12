import { type PropsDaAba } from "../busca";
import { TabelaDePessoas } from "./TabelaDePessoas";

export function AbaPerformanceAjudante(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="ajudante" {...props} />;
}
