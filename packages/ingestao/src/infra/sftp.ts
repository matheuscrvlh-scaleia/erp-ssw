/** Cliente SFTP (ssh2-sftp-client) atrás da porta `ClienteSftp`. */
import SftpClient from "ssh2-sftp-client";

import { type ClienteSftp, type ConexaoSftp } from "../casos-de-uso/portas";

const TEMPO_DE_CONEXAO_MS = 15_000;

export function criarClienteSftp(): ClienteSftp {
  return {
    async conectar(c): Promise<ConexaoSftp> {
      const sftp = new SftpClient();
      await sftp.connect({
        host: c.host,
        port: c.porta,
        username: c.usuario,
        password: c.senha,
        readyTimeout: TEMPO_DE_CONEXAO_MS,
      });
      return {
        existe: async (caminho) => (await sftp.exists(caminho)) !== false,
        async listar(pasta) {
          return (await sftp.list(pasta)).map((e) => ({
            nome: e.name,
            tamanho: e.size,
            mtime: e.modifyTime,
            tipo: e.type === "-" ? "arquivo" : e.type === "d" ? "pasta" : "outro",
          }));
        },
        async baixar(caminho) {
          const dados = await sftp.get(caminho);
          if (!Buffer.isBuffer(dados)) throw new Error(`Download inesperado de ${caminho}`);
          return new Uint8Array(dados);
        },
        async enviar(bytes, caminho) {
          await sftp.put(Buffer.from(bytes), caminho);
        },
        async renomear(de, para) {
          await sftp.rename(de, para);
        },
        async apagar(caminho) {
          await sftp.delete(caminho);
        },
        async criarPasta(caminho) {
          await sftp.mkdir(caminho, true);
        },
        async apagarPasta(caminho) {
          await sftp.rmdir(caminho, true);
        },
        async encerrar() {
          await sftp.end();
        },
      };
    },
  };
}
