import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    wasm(),
    topLevelAwait(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  // Handle jsimgui dynamic imports - ignore missing variants we don't use
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings about jsimgui variants we don't build
        if (warning.code === 'UNRESOLVED_IMPORT' &&
            warning.exporter?.includes('jsimgui')) {
          return;
        }
        warn(warning);
      },
    },
  },
  // Optimize jsimgui dependencies
  optimizeDeps: {
    include: ['@voidscript/imgui'],
    esbuildOptions: {
      // Ignore dynamic imports to missing jsimgui variants
      logOverride: {
        'ignored-bare-import': 'silent',
      },
    },
  },
}));
