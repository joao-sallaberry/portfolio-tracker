import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Fail the build instead of shipping an app that can't reach Supabase (e.g. env vars missing on the host)
  if (command === "build") {
    const env = { ...loadEnv(mode, import.meta.dirname), ...process.env };
    const missing = REQUIRED_ENV.filter((name) => !env[name]);
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")} (see .env.example)`);
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
