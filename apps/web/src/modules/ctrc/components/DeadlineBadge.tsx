import { statusDoPrazo } from "@erp/domain/ctrc/detail";
import { type DetalheCtrc } from "@erp/shared/contracts/ctrc";

import { SeloStatus, type Tom } from "@/components/common/StatusBadge";

export function SeloDoPrazo({ ctrc, fuso }: { ctrc: DetalheCtrc; fuso: string }) {
  const s = statusDoPrazo(ctrc, new Date(), fuso);
  const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  const selo = (tom: Tom, texto: string) => <SeloStatus tom={tom}>{texto}</SeloStatus>;
  switch (s.tipo) {
    case "sem_previsao":
      return selo("neutro", "Sem previsão");
    case "baixado":
      return selo("neutro", "Baixado sem entrega");
    case "entregue_no_prazo":
      return selo("sucesso", "Entregue no prazo");
    case "entregue_com_atraso":
      return selo("alerta", `Entregue com ${dias(s.dias)} de atraso`);
    case "no_prazo":
      return selo("sucesso", "No prazo");
    case "atrasado":
      return selo("erro", `Atrasado ${dias(s.dias)}`);
  }
}
