import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  resolve: {
    alias: {
      // Garante que o AWS SDK use a versão de navegador para configuração de runtime,
      // evitando tentativas de acesso ao sistema de arquivos (fs).
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  optimizeDeps: {
    exclude: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  },
});