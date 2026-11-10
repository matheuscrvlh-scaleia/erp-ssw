/**
 * Dia do seletor de datas (o react-day-picker trabalha com `Date` à meia-noite local) ↔
 * "AAAA-MM-DD", sem passar por UTC. Serve à tela do calendário e ao nome do arquivo exportado;
 * o "hoje" das regras vem sempre de `hojeNoFuso` (Q11).
 */
export function dataDoCalendario(iso: string): Date {
  const [ano = 1970, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function isoDoCalendario(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${String(data.getFullYear())}-${mes}-${dia}`;
}
