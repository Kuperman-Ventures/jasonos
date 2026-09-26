/**
 * Render Phosphor GraduationCap (duotone) brand icons to match the left rail.
 * Usage: node scripts/render-brand-icons.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const brand = "#2f5aa0";

// Phosphor GraduationCap duotone paths (viewBox 0 0 256 256)
const secondary =
  "M216,113.07v53.22a8,8,0,0,1-2,5.31c-11.3,12.59-38.9,36.4-86,36.4s-74.68-23.81-86-36.4a8,8,0,0,1-2-5.31V113.07L128,160Z";
const primary =
  "M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z";

function svgFor(size, { padded = false } = {}) {
  // Keep a little inset so the glyph doesn't clip at tiny favicon sizes.
  const inset = padded ? 18 : 8;
  const inner = 256;
  const vb = `${-inset} ${-inset} ${inner + inset * 2} ${inner + inset * 2}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}" fill="none">
  <path d="${secondary}" fill="${brand}" opacity="0.2"/>
  <path d="${primary}" fill="${brand}"/>
</svg>`;
}

async function pngFromSvg(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

/** Minimal multi-size ICO writer (PNG-compressed images). */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  const bodies = [];

  for (const png of pngBuffers) {
    // Read IHDR for width/height
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    bodies.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...bodies]);
}

async function main() {
  const outDir = join(root, "app");
  const publicDir = join(root, "public");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  const icon192 = await pngFromSvg(svgFor(192), 192);
  const apple180 = await pngFromSvg(svgFor(180, { padded: true }), 180);
  const logo512 = await pngFromSvg(svgFor(512, { padded: true }), 512);
  const fav16 = await pngFromSvg(svgFor(16, { padded: true }), 16);
  const fav32 = await pngFromSvg(svgFor(32, { padded: true }), 32);
  const fav48 = await pngFromSvg(svgFor(48, { padded: true }), 48);

  writeFileSync(join(outDir, "icon.png"), icon192);
  writeFileSync(join(outDir, "apple-icon.png"), apple180);
  writeFileSync(join(publicDir, "logo.png"), logo512);

  const ico = buildIco([fav16, fav32, fav48]);
  writeFileSync(join(outDir, "favicon.ico"), ico);
  writeFileSync(join(publicDir, "favicon.ico"), ico);

  // Also keep an SVG source for reference / future regen
  writeFileSync(join(publicDir, "brand-mark.svg"), svgFor(256, { padded: true }));

  console.log("Wrote icon.png, apple-icon.png, favicon.ico, logo.png, brand-mark.svg");
  console.log("sizes", {
    icon: icon192.length,
    apple: apple180.length,
    logo: logo512.length,
    ico: ico.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
