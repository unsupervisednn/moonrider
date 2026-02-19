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
      fs.cpSync(sourceDir, destinationDir, { recursive: true, force: true });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hosts = (process.env.HOSTS ?? '').split(',').map(host => host.trim()).filter(Boolean);

  return {
    base: './',
    server: {
      allowedHosts: hosts,
    },
    build: {
      outDir: 'build',
      emptyOutDir: true
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
