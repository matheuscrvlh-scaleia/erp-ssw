import { type ResumoPerformance } from "@erp/shared/contratos/performance";
import { ArrowRight } from "lucide-react";

import { Aviso } from "@/componentes/comum/Aviso";
import { Button } from "@/componentes/ui/button";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

/** Avisos do topo da Performance: erro, período longo, CTRCs concentrados e códigos a classificar. */
export function AvisosDaPerformance({
  erro,
  dias,
  periodo,
  resumo: r,
}: {
  erro: Error | null;
  dias: number;
  periodo: { inicio: string; fim: string };
  resumo: ResumoPerformance | undefined;
}) {
  const cobertura = r?.cobertura;
  return (
    <>
      {erro && (
        <Aviso tom="erro">
          {mensagemAmigavel(erro, "Não foi possível carregar os dados de performance.")}
        </Aviso>
      )}

      {dias > 183 && (
        <Aviso tom="alerta" titulo={`Período longo selecionado (${String(dias)} dias).`}>
          A consulta pode demorar alguns segundos — considere aplicar filtros de unidade, parceiro
          ou filial para acelerar o carregamento.
        </Aviso>
      )}

      {r &&
        cobertura?.min &&
        cobertura.max &&
        (r.totais.totalCtrcs === 0 || cobertura.min === cobertura.max) && (
          <Aviso tom="info">
            {r.totais.totalCtrcs === 0 ? (
              <>
                Sem CTRCs no intervalo <strong>{periodo.inicio}</strong> →{" "}
                <strong>{periodo.fim}</strong>.{" "}
              </>
            ) : (
              <>
                Os números podem parecer iguais entre períodos porque os CTRCs disponíveis estão
                concentrados em <strong>{cobertura.min}</strong>.{" "}
              </>
            )}
            Mudar o período só altera os valores quando há CTRCs em datas diferentes dentro da
            janela.
          </Aviso>
        )}

      {r && r.totais.ocorrenciasPendentes > 0 && (
        <Aviso
          tom="alerta"
          acao={
            <Button asChild size="sm" variant="outline">
              <a href="/admin/configuracoes?aba=codigos">
                Classificar agora <ArrowRight aria-hidden />
              </a>
            </Button>
          }
        >
          <strong className="font-semibold">{r.totais.ocorrenciasPendentes}</strong> ocorrências
          precisam de classificação para os números ficarem 100% exatos.
        </Aviso>
      )}
    </>
  );
}
