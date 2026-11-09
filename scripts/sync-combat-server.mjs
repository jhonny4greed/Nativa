import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const target=resolve(root,"supabase/functions/_shared/game"); mkdirSync(target,{recursive:true});
const seen=new Set();
function copy(path) {
  if(seen.has(path))return; seen.add(path);
  const source=readFileSync(path,"utf8");
  for(const match of source.matchAll(/from\s+["'](\.\/?[^"']+)["']/g))copy(resolve(dirname(path),match[1]));
  writeFileSync(resolve(target,basename(path)),source);
}
copy(resolve(root,"js/combat-domain.js"));
console.log(`Motor compartilhado: ${seen.size} módulos sincronizados.`);
