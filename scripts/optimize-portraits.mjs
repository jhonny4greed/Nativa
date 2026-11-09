import sharp from "sharp";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../assets/generated/", import.meta.url));
for (const id of ["guara", "arua", "tatua", "quira", "ecoa"]) {
  const result = await sharp(`${directory}nativa-${id}.png`)
    .resize({ width: 960, withoutEnlargement: true })
    .webp({ quality: 85, effort: 5 })
    .toFile(`${directory}nativa-${id}.webp`);
  console.log(`${id}: ${Math.round(result.size / 1024)} KiB`);
}
