
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // AWS SDK (e algumas outras libs) esperam que 'global' exista no ambiente window
    global: 'window',
  },
  resolve: {
    alias: {
      // Garante que o navegador não tente carregar módulos de servidor do AWS SDK
      './runtimeConfig': './runtimeConfig.browser',
      // Mocks para módulos Node.js que não existem no navegador
      fs: '/lib/polyfills.ts',
      path: '/lib/polyfills.ts',
      os: '/lib/polyfills.ts',
    },
  },
});
