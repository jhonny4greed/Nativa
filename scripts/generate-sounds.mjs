// Original synthesized game effects, generated locally without an external catalogue.
import { mkdir, writeFile } from "node:fs/promises";
import { wavMono } from "../js/audio-clips.js";
const folder = new URL("../assets/audio/sfx/", import.meta.url);
await mkdir(folder, { recursive: true });
const rate = 24000;
for (const [name, duration, base, modulation, noisy] of [
  ["cry-mammal", 1.8, 165, 32, 0.12],
  ["cry-bird", 1.8, 740, 160, 0.015],
  ["cry-reptile", 1.8, 110, 20, 0.5],
  ["cry-amphibian", 1.8, 270, 50, 0.1],
  ["cry-insect", 1.8, 1100, 80, 0.12],
  ["cry-aquatic", 1.8, 360, 75, 0.2],
  ["attack-fogo", 1.5, 130, 25, 0.6],
  ["attack-agua", 1.5, 430, 160, 0.35],
  ["attack-terra", 1.5, 75, 18, 0.4],
  ["attack-vento", 1.5, 670, 100, 0.5],
  ["attack-energia", 1.5, 480, 200, 0.08],
  ["attack-impact", 1.5, 100, 40, 0.3]
]) {
  const samples = new Float32Array(rate * duration);
  let phase = 0,
    seed = 173,
    lowNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate,
      x = t / duration;
    seed = (1664525 * seed + 1013904223) >>> 0;
    lowNoise = lowNoise * 0.75 + (seed / 2147483648 - 1) * 0.25;
    const pulse = name.includes("bird") ? Math.pow(Math.max(0, Math.sin(t * 10)), 2) : 0.65 + 0.35 * Math.sin(t * 18);
    const frequency = base * (1.2 - 0.35 * x) + modulation * Math.sin(t * 14);
    phase += (2 * Math.PI * frequency) / rate;
    const envelope = Math.min(1, t / 0.08, (duration - t) / 0.16) * Math.pow(Math.sin(Math.PI * x), 0.6);
    samples[i] =
      envelope * pulse * ((Math.sin(phase) + 0.3 * Math.sin(2.03 * phase)) * 0.25 * (1 - noisy) + lowNoise * noisy);
  }
  await writeFile(new URL(`${name}.wav`, folder), Buffer.from(await wavMono(samples, rate).arrayBuffer()));
}
console.log("12 short sound assets generated (1.5–1.8 seconds).");
