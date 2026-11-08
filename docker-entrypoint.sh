#!/bin/sh
set -e

# Gera a configuração do Supabase em runtime a partir das variáveis de ambiente.
# Os valores padrão mantêm o comportamento de desenvolvimento local.
cat > /usr/share/nginx/html/js/supabase-config.js <<EOF
// Gerado em runtime pelo docker-entrypoint.sh. Não editar manualmente no container.
export const SUPABASE_URL = "${SUPABASE_URL:-http://127.0.0.1:54321}";
export const SUPABASE_PUBLISHABLE_KEY = "${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}";
EOF

exec nginx -g 'daemon off;'
