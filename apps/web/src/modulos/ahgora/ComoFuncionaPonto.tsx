// TODO(kit-ui): trocar pelo ComoFunciona do kit comum.
import { ComoFunciona, ComoFuncionaSecao, Formula } from "../ranking/kit-local";

/**
 * Explicação da página de ponto — vale para as duas abas.
 * origem: features/ahgora/components/ComoFuncionaPonto.tsx (sistema atual)
 */
export function ComoFuncionaPonto() {
  return (
    <ComoFunciona
      chave="ponto-ahgora"
      titulo="Como funciona o ponto (Ahgora)"
      resumo="Os dados vêm direto do Ahgora a cada consulta. O painel não guarda batida nenhuma: o que aparece é o que está no Ahgora naquele momento."
    >
      <ComoFuncionaSecao titulo="As duas abas">
        <p>
          <strong>Apuração do período</strong>: soma as horas trabalhadas no mês de cada
          colaborador, com filtro por departamento. É a visão para fechamento.
        </p>
        <p>
          <strong>Batidas por colaborador</strong>: lista cada marcação de uma pessoa, com tipo,
          dispositivo, localização e motivo. Serve para conferir um dia específico. Aceita no máximo
          30 dias por consulta.
        </p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="Como as horas do dia são calculadas">
        <p>
          As batidas do dia são ordenadas por horário e agrupadas em pares: a 1ª com a 2ª, a 3ª com
          a 4ª, e assim por diante. Cada par é uma entrada e uma saída.
        </p>
        <Formula>horas do dia = (saída 1 − entrada 1) + (saída 2 − entrada 2) + …</Formula>
        <p>
          Exemplo: 08:00 · 12:00 · 13:00 · 17:20 → 4h + 4h20 = <strong>8h20</strong>.
        </p>
        <p>
          Batidas repetidas no mesmo minuto (o relógio às vezes grava duas vezes) contam uma vez só.
        </p>
        <Formula>horas apuradas do mês = soma das horas de todos os dias que fecharam</Formula>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="Quando um dia vai para “revisar”">
        <p>
          Se o dia não fecha com segurança, o painel <strong>não estima</strong>: marca como
          “revisar” e esse dia <strong>não entra</strong> nas horas apuradas. Acontece em dois
          casos:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Número ímpar de batidas</strong>: faltou uma marcação, ou o turno passou da
            meia-noite e o par ficou no dia seguinte.
          </li>
          <li>
            <strong>Batida excluída no dia</strong>: o Ahgora não informa qual marcação substituiu a
            excluída, então o dia precisa ser conferido.
          </li>
        </ul>
        <p>Corrija a marcação no Ahgora e apure de novo: o dia passa a contar automaticamente.</p>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="Limites da consulta">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            O Ahgora devolve as batidas de um colaborador por vez, então apurar um departamento
            inteiro leva alguns segundos.
          </li>
          <li>
            Até <strong>150 colaboradores</strong> por apuração. Acima disso, escolha um
            departamento.
          </li>
          <li>Demitidos ficam de fora, a menos que “Incluir demitidos” esteja ligado.</li>
        </ul>
      </ComoFuncionaSecao>

      <ComoFuncionaSecao titulo="Onde mais essas horas são usadas">
        <p>
          A <strong>Bonificação de entrega</strong> usa o mesmo cálculo para saber se o colaborador
          fez hora extra no dia, e isso decide entre Turbo e Acelerado.
        </p>
      </ComoFuncionaSecao>
    </ComoFunciona>
  );
}
