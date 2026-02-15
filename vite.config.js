import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
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
    plugins: [viteCommonjs(), glslAsTextPlugin()]
  };
});
