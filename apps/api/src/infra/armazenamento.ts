import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Arquivos públicos (logo da empresa) num bucket S3 compatível. */
export interface Armazenamento {
  enviar(caminho: string, conteudo: Uint8Array, tipo: string): Promise<void>;
  apagar(caminho: string): Promise<void>;
}

interface ConfigS3 {
  endpoint: string | undefined;
  regiao: string;
  bucket: string;
  chaveDeAcesso: string;
  segredo: string;
  /** MinIO e afins pedem o bucket no caminho, não no subdomínio. */
  caminhoNoEstilo: boolean;
}

export function criarArmazenamentoS3(config: ConfigS3): Armazenamento {
  const cliente = new S3Client({
    region: config.regiao,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.caminhoNoEstilo,
    credentials: { accessKeyId: config.chaveDeAcesso, secretAccessKey: config.segredo },
  });
  return {
    enviar: async (caminho, conteudo, tipo) => {
      await cliente.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: caminho,
          Body: conteudo,
          ContentType: tipo,
          // Nome novo a cada envio: o arquivo nunca muda, pode ficar em cache.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    apagar: async (caminho) => {
      await cliente.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: caminho }));
    },
  };
}
