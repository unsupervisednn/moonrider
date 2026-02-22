import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

function glslAsTextPlugin () {
  return {
    name: 'moonrider-glsl-as-text',
    load (id) {
      if (!id.endsWith('.glsl')) { return null; }
      const shader = fs.readFileSync(id, 'utf8');
      return `export default ${JSON.stringify(shader)};`;
    }
  };
}

function copyStaticAssetsPlugin () {
  let outDir = 'build';

  return {
    name: 'moonrider-copy-static-assets',
    apply: 'build',
    configResolved (config) {
      outDir = config.build.outDir;
    },
    closeBundle () {
      const sourceDir = path.resolve(process.cwd(), 'assets');
      const destinationDir = path.resolve(process.cwd(), outDir, 'assets');
      copyDirectoryRecursive(sourceDir, destinationDir);
    }
  };
}

function copyDirectoryRecursive (sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }
}

// console.log('env', JSON.stringify(process.env, null, 2));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hosts = (env.HOSTS ?? process.env.HOSTS ?? '').split(',').map(host => host.trim()).filter(Boolean);
  const apiProxyTarget = env.API_PROXY_TARGET ?? process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

  return {
    base: './',
    server: {
      allowedHosts: hosts,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'build',
      emptyOutDir: false
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.DEBUG_LOG': JSON.stringify(env.DEBUG_LOG || ''),
      'process.env.DEBUG_AFRAME': JSON.stringify(env.DEBUG_AFRAME || ''),
      'process.env.DEBUG_KEYBOARD': JSON.stringify(env.DEBUG_KEYBOARD || ''),
      'process.env.DEBUG_INSPECTOR': JSON.stringify(env.DEBUG_INSPECTOR || '')
    },
    plugins: [glslAsTextPlugin(), copyStaticAssetsPlugin()]
  };
});
