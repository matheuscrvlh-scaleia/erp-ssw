import { type FuncionarioApurado } from "@erp/shared/contratos/ahgora";

import { CLASSE_CABECALHO, CLASSE_TABELA, CLASSE_TH } from "@/componentes/comum/classes-de-tabela";
import { cn } from "@/lib/utils";

import { LinhaDoFuncionario } from "./LinhaDoFuncionario";

/** Colaboradores apurados, uma linha expansível por colaborador. */
export function TabelaDaApuracao({ funcionarios }: { funcionarios: FuncionarioApurado[] }) {
  return (
    <div className="rolagem-fina relative overflow-x-auto rounded-b-xl">
      <table className={CLASSE_TABELA}>
        <thead>
          <tr className={CLASSE_CABECALHO}>
            <th scope="col" className={CLASSE_TH}>
              Colaborador
            </th>
            <th scope="col" className={CLASSE_TH}>
              Matrícula
            </th>
            <th scope="col" className={CLASSE_TH}>
              Departamento
            </th>
            <th scope="col" className={cn(CLASSE_TH, "text-right")}>
              Dias
            </th>
            <th scope="col" className={cn(CLASSE_TH, "text-right")}>
              Horas apuradas
            </th>
            <th scope="col" className={cn(CLASSE_TH, "text-right")}>
              A revisar
            </th>
          </tr>
        </thead>
        <tbody>
          {funcionarios.map((f) => (
            <LinhaDoFuncionario key={f.register} f={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
