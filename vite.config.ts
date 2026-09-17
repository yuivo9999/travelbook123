import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, UserConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig((): UserConfig => {
  // Universal relative path for all packaging and static hosts
  const basePath = './';

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), viteSingleFile()],
    css: {
      // @ts-ignore
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          chrome: 80 << 16, // Compatibility for older Android WebViews
        },
      },
    },
    build: {
      // @ts-ignore
      cssMinify: 'lightningcss',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
