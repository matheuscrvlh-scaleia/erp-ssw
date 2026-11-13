import { type PropsDaAba } from "../search";
import { TabelaDePessoas } from "./PeopleTable";

export function AbaPerformanceMotorista(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="motorista" {...props} />;
}
