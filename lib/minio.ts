
import { S3Client } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = "https://apiminio.santosapp.com.br";
const MINIO_ACCESS_KEY = "pedro";
const MINIO_SECRET_KEY = "4aki4kfKSSF9nhY";
const MINIO_REGION = "us-east-1";

export const MINIO_BUCKET_NAME = "syncup";

// Importante: Em produção, o Secret Key não deve ficar exposto no frontend.
// O ideal seria um backend para gerar URLs assinadas.
export const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: MINIO_REGION,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Necessário para MinIO (bucket no path da URL)
});

/**
 * Gera a URL pública para um arquivo armazenado.
 * Garante que não hajam barras duplicadas e que o nome do arquivo esteja devidamente codificado.
 */
export const getPublicUrl = (fileName: string) => {
  // Remove barra final do endpoint se existir
  const cleanEndpoint = MINIO_ENDPOINT.replace(/\/+$/, "");
  // Codifica o nome do arquivo para garantir que caracteres especiais não quebrem o link
  const encodedFileName = encodeURIComponent(fileName);
  
  return `${cleanEndpoint}/${MINIO_BUCKET_NAME}/${encodedFileName}`;
};
