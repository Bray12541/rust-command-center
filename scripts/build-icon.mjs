import fs from "node:fs/promises";
import path from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

/* global console */

const source = path.resolve("resources", "icon.svg");
const output = path.resolve("resources", "icon.ico");
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);

await fs.writeFile(output, await pngToIco(images));
console.log(`Created ${output}`);
