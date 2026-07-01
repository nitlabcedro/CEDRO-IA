import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // ⚠️  SEGURANÇA: Apenas variáveis seguras para o cliente são expostas aqui.
  // NUNCA adicione SUPABASE_SERVICE_ROLE_KEY ou qualquer chave secreta neste bloco.
  // A service role key é exclusiva do servidor (app.ts / Netlify Functions).
  const clientSafeEnv = {
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
    ),
  };

  return {
    plugins: [react(), tailwindcss()],
    define: clientSafeEnv,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
