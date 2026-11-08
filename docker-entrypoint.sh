#!/bin/sh
set -e

# Gera a configuração pública em runtime a partir das variáveis de ambiente.
# Os valores padrão mantêm o comportamento de desenvolvimento local.
cat > /usr/share/nginx/html/env.js <<EOT
// Gerado em runtime pelo docker-entrypoint.sh. Não editar manualmente no container.
window.__NATIVA_ENV__ = {
  SUPABASE_URL: "${SUPABASE_URL:-http://127.0.0.1:54321}",
  SUPABASE_PUBLISHABLE_KEY: "${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}",
  TURNSTILE_SITE_KEY: "${TURNSTILE_SITE_KEY:-}"
};
EOT

exec nginx -g 'daemon off;'
