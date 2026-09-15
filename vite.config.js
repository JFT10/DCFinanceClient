import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';

const host = process.env.TAURI_DEV_HOST;

// Custom Vite plugin to read & write key.env in browser dev mode
function envKeyPlugin() {
  return {
    name: 'env-key-handler',
    configureServer(server) {
      server.middlewares.use('/__api/env-key', (req, res, next) => {
        const envPath = path.resolve(process.cwd(), 'key.env');

        if (req.method === 'GET') {
          let key = '';
          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            for (const line of content.split('\n')) {
              const trimmed = line.trim();
              if (trimmed.startsWith('TREASURY_API_KEY=')) {
                key = trimmed.substring('TREASURY_API_KEY='.length).trim();
                key = key.replace(/^["']|["']$/g, '');
                break;
              }
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ key }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { key } = JSON.parse(body || '{}');
              const content = `# DemocracyCraft Treasury API Key Configuration\n# Updated by DC Finance Client\nTREASURY_API_KEY="${key || ''}"\n`;
              fs.writeFileSync(envPath, content, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [svelte(), envKeyPlugin()],

  // Vite options tailored for Tauri development and browser dev preview
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // Proxy /api requests to avoid browser CORS issues during web preview
    proxy: {
      '/api': {
        target: 'https://api.democracycraft.net/economy',
        changeOrigin: true,
        secure: true,
      },
    },
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // tell vite to ignore watching `src-tauri` and `key.env` from triggering full reloads
      ignored: ['**/src-tauri/**', '**/key.env'],
    },
  },
}));
