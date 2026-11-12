import { type MOTIVOS_DE_REVISAO } from "@erp/shared/contratos/ahgora";

export const MOTIVO_LABEL: Record<(typeof MOTIVOS_DE_REVISAO)[number], string> = {
  impar: "Número ímpar de batidas — falta uma marcação ou o turno virou a meia-noite",
  excluida: "Há batida excluída no dia — confira a marcação que a substituiu",
};

export const TIPO_LABEL: Record<string, string> = {
  ORIGINAL: "Original",
  MANUAL: "Manual",
  ONLINE: "Online",
  DELETADA: "Deletada",
};

/** Minutos em `8h 20m` (sem os minutos quando zerados: `8h`). */
export function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h${m > 0 ? ` ${String(m).padStart(2, "0")}m` : ""}`;
}

/** `AAAA-MM-DD` em `DD/MM/AAAA`. */
export const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Latitude e longitude com 6 casas, ou "—" se faltar uma delas. */
export function localizacaoDaBatida(latitude?: number, longitude?: number): string {
  return latitude !== undefined && longitude !== undefined
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : "—";
}
