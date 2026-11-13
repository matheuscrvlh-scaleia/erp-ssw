import { type PropsDaAba } from "../search";
import { TabelaDePessoas } from "./PeopleTable";

export function AbaPerformanceAjudante(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="ajudante" {...props} />;
}
