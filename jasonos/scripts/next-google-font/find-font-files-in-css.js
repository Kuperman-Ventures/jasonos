"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findFontFilesInCss = findFontFilesInCss;
const formatToExtension = new Map([
  ["woff", "woff"],
  ["woff2", "woff2"],
  ["truetype", "ttf"],
  ["opentype", "otf"],
  ["embedded-opentype", "eot"],
]);
/**
 * Next.js 16.4.3 findFontFilesInCss: Google can return extensionless
 * /l/font?kit=... URLs. Prefer the pathname extension, then the CSS
 * format hint, then woff2. See vercel/next.js#99114.
 */
function findFontFilesInCss(css, subsetsToPreload) {
  const fontFiles = [];
  let currentSubset = "";
  for (const line of css.split("\n")) {
    const newSubset = /\/\* (.+?) \*\//.exec(line)?.[1];
    if (newSubset) {
      currentSubset = newSubset;
      continue;
    }
    const googleFontFileUrl = /src: url\((.+?)\)/.exec(line)?.[1];
    if (
      googleFontFileUrl &&
      !fontFiles.some(
        (foundFile) => foundFile.googleFontFileUrl === googleFontFileUrl,
      )
    ) {
      const pathname = googleFontFileUrl.split(/[?#]/, 1)[0];
      const format = /format\(['"](.+?)['"]\)/.exec(line)?.[1];
      const ext =
        /\.(woff|woff2|eot|ttf|otf)$/.exec(pathname)?.[1] ??
        formatToExtension.get(format ?? "") ??
        "woff2";
      fontFiles.push({
        googleFontFileUrl,
        preloadFontFile: !!subsetsToPreload?.includes(currentSubset),
        ext,
      });
    }
  }
  return fontFiles;
}
