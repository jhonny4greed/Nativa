import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../assets/generated/", import.meta.url));
const ids = ["guara", "arua", "tatua", "quira", "ecoa"];
for (const id of ids) {
  const input = `${directory}arena-${id}.png`;
  const data = await sharp(input)
    .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(`${directory}arena-${id}.webp`);
  console.log(`${id}: ${Math.round(data.size / 1024)} KiB`);
}

const manifest = {
  method: "ImageGen isolated cutout from supplied Nativa artwork; transparent background requested; resized and encoded with Sharp without changing alpha",
  prompt: "Preserve the full creature and its identity from the supplied Nativa reference. Create an isolated game sprite with a transparent background. Remove all environment and background; only the animal remains, including its body parts and attached details.",
  files: ids.map((id) => `arena-${id}.png`),
};
writeFileSync(`${directory}arena-art-prompts.json`, `${JSON.stringify(manifest, null, 2)}\n`);
