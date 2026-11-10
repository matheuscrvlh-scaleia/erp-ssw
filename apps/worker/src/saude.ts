import { createServer, type Server } from "node:http";

/**
 * `/healthz` do worker (para o orquestrador reiniciar se travar): 200 se as verificações
 * passam, 503 se alguma falha. Nada além disso é servido.
 */
export function criarServidorDeSaude(verificar: () => Promise<void>): Server {
  return createServer((request, response) => {
    if (request.url !== "/healthz") {
      response.writeHead(404).end();
      return;
    }
    verificar().then(
      () => response.writeHead(200, { "content-type": "application/json" }).end('{"status":"ok"}'),
      () =>
        response
          .writeHead(503, { "content-type": "application/json" })
          .end('{"status":"indisponivel"}'),
    );
  });
}
