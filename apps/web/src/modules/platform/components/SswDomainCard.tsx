import { dadosDaEmpresa, type EmpresaCompleta } from "@erp/shared/contracts/platform";
import { useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPO, Campo } from "@/components/common/FormFields";
import { Painel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { useGravacao } from "@/hooks/use-save";

import { mutacaoSalvarEmpresa } from "../api";
import { formularioDaEmpresa } from "../rules";

/** Domínio da empresa no SSW, salvo junto com os dados da empresa. */
export function CartaoDoDominioSsw({ empresa }: { empresa: EmpresaCompleta }) {
  const [dominio, setDominio] = useState(empresa.dominioSsw ?? "");
  useEffect(() => {
    setDominio(empresa.dominioSsw ?? "");
  }, [empresa.dominioSsw]);
  const lido = dadosDaEmpresa.safeParse({ ...formularioDaEmpresa(empresa), dominioSsw: dominio });
  const erro = lido.success
    ? null
    : (lido.error.issues.find((i) => i.path[0] === "dominioSsw")?.message ?? null);
  const alterado = dominio !== (empresa.dominioSsw ?? "");
  const cliente = useQueryClient();
  const salvar = useGravacao({
    mutacao: mutacaoSalvarEmpresa(cliente, empresa.id),
    sucesso: "Domínio SSW salvo",
  });

  return (
    <Painel
      titulo="Domínio SSW"
      descricao="Sigla da transportadora no SSW, usada na gravação dos CT-e."
      icone={Globe}
      classeDoCorpo="flex flex-wrap items-end gap-3 p-5"
    >
      <div className="min-w-[220px] flex-1">
        <Campo rotulo="Domínio" erro={erro}>
          <input
            className={CAMPO}
            value={dominio}
            placeholder="Ex.: FRT"
            onChange={(e) => {
              setDominio(e.target.value);
            }}
          />
        </Campo>
      </div>
      <Button
        disabled={!alterado || !lido.success || salvar.gravando}
        onClick={() => {
          if (lido.success) void salvar.gravar(lido.data);
        }}
      >
        {salvar.gravando ? "Salvando…" : "Salvar"}
      </Button>
    </Painel>
  );
}
