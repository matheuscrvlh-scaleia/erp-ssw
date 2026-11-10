import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";

/** Rótulo do tipo de documento nos filtros ("sem tipo" para o marcador de vazio). */
export const rotuloDoTipo = (tipo: string) => (tipo === SEM_TIPO ? "sem tipo" : tipo);

export const opcoesDeTipo = (tipos: readonly string[]) =>
  tipos.map((valor) => ({ valor, rotulo: rotuloDoTipo(valor) }));
