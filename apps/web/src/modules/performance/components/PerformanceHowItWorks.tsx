import { ComoFunciona, ComoFuncionaSecao, Formula } from "@/components/common/HowItWorks";

/** Definições dos indicadores da Performance (o texto que ficava sob os cartões). */
export function ComoFuncionaPerformance({
  otifVisivel,
  nomeCurto,
}: {
  otifVisivel: boolean;
  nomeCurto: string;
}) {
  return (
    <ComoFunciona
      chave="performance"
      titulo="Performance"
      resumo="Como cada indicador da tela é calculado. Clique num cartão para abrir a lista dos CT-e."
    >
      <ComoFuncionaSecao titulo="SLA Operacional">
        <Formula>(CT-e emitidos − entregues fora do prazo) ÷ CT-e emitidos</Formula>
        <p>Fora do prazo exclui responsabilidade do cliente.</p>
      </ComoFuncionaSecao>
      <ComoFuncionaSecao titulo="Nascidos em atraso">
        <p>
          CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega — o atraso é do
          parceiro, não da {nomeCurto}.
        </p>
      </ComoFuncionaSecao>
      {otifVisivel && (
        <ComoFuncionaSecao titulo="OTIF">
          <p>
            Percentual dos CTRCs do período que tiveram algum problema no percurso (pendência do
            cliente ou da operação), mesmo que tenham sido entregues no fim. Quanto menor, melhor —
            mesma leitura usada na tela de Romaneio, que mede só as cargas que já saíram para
            entrega.
          </p>
        </ComoFuncionaSecao>
      )}
    </ComoFunciona>
  );
}
