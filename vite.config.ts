import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  // This repository is published at https://tarakadidata-wq.github.io/rere/.
  base: mode === 'pages' ? '/rere/' : '/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false },
}));
