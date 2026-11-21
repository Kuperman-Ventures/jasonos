/**
 * Apply Next.js 16.4.3's Google font loader fix on 16.2.4.
 *
 * Google Fonts sometimes answers with extensionless `/l/font?kit=` URLs
 * (HTTP 200). Webpack next/font then does
 * `/\.(woff|woff2|eot|ttf|otf)$/.exec(url)[1]` and throws
 * `Cannot read properties of null (reading '1')`, which failed the
 * jasonos production build (Vercel dpl_C9Tbj34vcz1W14DpqSfvGTJWbv1s,
 * app/iugr/layout.tsx → IBM Plex Sans). See vercel/next.js#99114.
 *
 * Vercel builds with `next build --webpack`, so patching the compiled
 * JS loader is enough for production. Idempotent: no-ops when the crash
 * regex is already gone.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const OLD_MAP =
  "fontFiles.map(async ({ googleFontFileUrl, preloadFontFile }) => {";
const NEW_MAP =
  "fontFiles.map(async ({ googleFontFileUrl, preloadFontFile, ext }) => {";
const CRASH_LINE =
  "            const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];\n";

export function patchLoaderSource(source) {
  if (source.includes(NEW_MAP) && !source.includes(CRASH_LINE)) {
    return source;
  }
  if (!source.includes(OLD_MAP) || !source.includes(CRASH_LINE)) {
    throw new Error(
      "next/font google loader.js is not the 16.2.4 webpack shape this patch expects",
    );
  }
  return source.replace(OLD_MAP, NEW_MAP).replace(CRASH_LINE, "");
}

function googleFontDir() {
  const nextRoot = path.dirname(require.resolve("next/package.json"));
  return path.join(nextRoot, "dist/compiled/@next/font/dist/google");
}

export function applyNextGoogleFontPatch(dir = googleFontDir()) {
  const loaderPath = path.join(dir, "loader.js");
  const findPath = path.join(dir, "find-font-files-in-css.js");
  const patchedFindPath = path.join(
    here,
    "next-google-font/find-font-files-in-css.js",
  );
  const loader = fs.readFileSync(loaderPath, "utf8");
  const patchedLoader = patchLoaderSource(loader);
  if (patchedLoader !== loader) {
    fs.writeFileSync(loaderPath, patchedLoader);
  }
  fs.copyFileSync(patchedFindPath, findPath);
  return { loaderPath, findPath, loaderChanged: patchedLoader !== loader };
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    const { loaderChanged } = applyNextGoogleFontPatch();
    console.log(
      loaderChanged
        ? "patched next/font google loader for extensionless font URLs"
        : "next/font google loader already has the extensionless URL fix",
    );
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.warn("skip next/font patch: next is not installed");
      process.exit(0);
    }
    throw err;
  }
}
