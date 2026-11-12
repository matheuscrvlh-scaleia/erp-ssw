import { type PropsDaAba } from "../busca";
import { TabelaDePessoas } from "./TabelaDePessoas";

export function AbaPerformanceMotorista(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="motorista" {...props} />;
}
