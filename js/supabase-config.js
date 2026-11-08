// Configuração pública do Supabase. Em produção, docker-entrypoint.sh gera /env.js com
// window.__NATIVA_ENV__; localmente usamos os valores do Supabase CLI. Apenas a chave
// publicável pertence ao navegador.
const env = globalThis.__NATIVA_ENV__ || {};
export const SUPABASE_URL = env.SUPABASE_URL || "http://127.0.0.1:54321";
export const SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const TURNSTILE_SITE_KEY = env.TURNSTILE_SITE_KEY || "";
