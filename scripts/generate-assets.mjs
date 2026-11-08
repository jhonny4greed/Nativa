#!/usr/bin/env node
// Gera os assets visuais do projeto via NVIDIA FLUX.1-dev.
// Uso: NVIDIA_API_KEY=... node scripts/generate-assets.mjs [id ...]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = path.join(ROOT, "assets/generated");
const ENDPOINT = process.env.NVIDIA_API_BASE_URL || "https://ai.api.nvidia.com";
const MODEL = process.env.NVIDIA_IMAGE_MODEL || "black-forest-labs/flux.1-dev";
const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) { console.error("Defina NVIDIA_API_KEY."); process.exit(1); }

const { style, assets } = JSON.parse(await readFile(path.join(ROOT, "scripts/asset-prompts.json"), "utf8"));
const only = new Set(process.argv.slice(2));
const force = process.env.FORCE === "1";
await mkdir(OUT, { recursive: true });

for (const asset of assets) {
  if (only.size && !only.has(asset.id)) continue;
  const target = path.join(OUT, `${asset.id}.jpg`);
  if (!force && existsSync(target)) { console.log(`skip ${asset.id}`); continue; }
  const body = { prompt: `${asset.prompt} ${style}`, mode: "base", cfg_scale: 3.5, width: asset.width, height: asset.height, seed: asset.seed ?? 0, steps: 50 };
  const started = Date.now();
  const res = await fetch(`${ENDPOINT}/v1/genai/${MODEL}`, {
    method: "POST", signal: AbortSignal.timeout(180_000),
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) { console.error(`FAIL ${asset.id} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`); continue; }
  const data = await res.json();
  const b64 = data?.artifacts?.[0]?.base64;
  if (!b64) { console.error(`FAIL ${asset.id}: resposta sem artifacts[0].base64`); continue; }
  const bytes = Buffer.from(b64, "base64");
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  await writeFile(isPng ? target.replace(/\.jpg$/, ".png") : target, bytes);
  console.log(`ok ${asset.id} ${asset.width}x${asset.height} ${(bytes.length / 1024).toFixed(0)}KB ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
