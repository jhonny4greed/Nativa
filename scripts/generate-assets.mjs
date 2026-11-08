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
const failed = [];

for (const asset of assets) {
  if (only.size && !only.has(asset.id)) continue;
  const target = path.join(OUT, `${asset.id}.jpg`);
  if (!force && existsSync(target)) { console.log(`skip ${asset.id}`); continue; }
  const body = { prompt: `${asset.prompt} ${style}`, mode: "base", cfg_scale: 3.5, width: asset.width, height: asset.height, seed: asset.seed ?? 0, steps: 50 };
  const started = Date.now();
  let bytes = null;
  for (let attempt = 1; attempt <= 4 && !bytes; attempt++) {
    const res = await fetch(`${ENDPOINT}/v1/genai/${MODEL}`, {
      method: "POST", signal: AbortSignal.timeout(180_000),
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(`retry ${asset.id} (${attempt}) HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
      continue;
    }
    const data = await res.json();
    const artifact = data?.artifacts?.[0];
    if (!artifact?.base64 || (artifact.finishReason && artifact.finishReason !== "SUCCESS")) {
      console.error(`retry ${asset.id} (${attempt}): finishReason=${artifact?.finishReason || "sem imagem"}`);
      body.seed += 1000;
      continue;
    }
    bytes = Buffer.from(artifact.base64, "base64");
    if (bytes.length < 20_000) { console.error(`retry ${asset.id} (${attempt}): imagem suspeita (${bytes.length} bytes)`); bytes = null; body.seed += 1000; }
  }
  if (!bytes) { console.error(`FAIL ${asset.id}`); failed.push(asset.id); continue; }
  // O arquivo referenciado pelo app é sempre <id>.jpg; o provedor devolve JPEG (verificado), mas se vier PNG
  // o conteúdo ainda é gravado no mesmo caminho para que o app aponte para a imagem nova.
  if (bytes[0] === 0x89 && bytes[1] === 0x50) console.warn(`aviso ${asset.id}: provedor devolveu PNG; gravado em ${path.basename(target)}`);
  await writeFile(target, bytes);
  console.log(`ok ${asset.id} ${asset.width}x${asset.height} ${(bytes.length / 1024).toFixed(0)}KB ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

if (failed.length) {
  console.error(`Assets não gerados: ${failed.join(", ")}`);
  process.exitCode = 1;
}
