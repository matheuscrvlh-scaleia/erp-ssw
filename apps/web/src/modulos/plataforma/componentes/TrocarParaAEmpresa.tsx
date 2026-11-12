import { type EmpresaCompleta } from "@erp/shared/contratos/plataforma";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trocarEmpresa } from "@/acesso/sessao";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { Painel } from "@/componentes/comum/Painel";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

/**
 * Ingestão, importação e Diagnóstico SSW leem e gravam na empresa ativa da sessão (o token
 * leva a empresa). Para operar a empresa aberta, a pessoa troca a empresa ativa com um clique; a
 * página recarrega já nela. Nada troca sozinho: a troca vale para a sessão inteira.
 */
export function TrocarParaAEmpresa({
  empresa,
  ativa,
}: {
  empresa: EmpresaCompleta;
  ativa: string | null;
}) {
  const queryClient = useQueryClient();
  const [trocando, setTrocando] = useState(false);
  const usar = async () => {
    setTrocando(true);
    try {
      await trocarEmpresa(empresa.id, queryClient);
    } catch (e) {
      toast.error(mensagemAmigavel(e, "Não foi possível trocar de empresa."));
      setTrocando(false);
    }
  };
  return (
    <Pagina titulo={empresa.nome}>
      <Painel>
        <EstadoVazio
          icone={ArrowLeftRight}
          mensagem={`Esta aba opera na empresa ativa da sessão${ativa ? `, hoje ${ativa}` : ""}.`}
          detalhe={`Para ver e operar ${empresa.nome}, troque a empresa ativa. O menu e as outras telas também passam a mostrar ${empresa.nome}.`}
          acao={
            <Button size="sm" onClick={() => void usar()} disabled={trocando}>
              <ArrowLeftRight aria-hidden />
              {trocando ? "Trocando…" : `Usar ${empresa.nome}`}
            </Button>
          }
        />
      </Painel>
    </Pagina>
  );
}
