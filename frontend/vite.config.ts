import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Server-only settings are loaded for development without exposing them through VITE_.
  const environment = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(environment)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
  server: {
    port: 3000,
    host: "127.0.0.1",
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
  ],
  };
})
