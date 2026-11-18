import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { applyNextGoogleFontPatch, patchLoaderSource } from "../../scripts/patch-next-google-font.mjs";

const require = createRequire(import.meta.url);
const googleFontDir = path.join(
  path.dirname(require.resolve("next/package.json")),
  "dist/compiled/@next/font/dist/google",
);

describe("next/font google extensionless URLs", () => {
  it("stops webpack from crashing on a URL with no file extension", () => {
    const crashed =
      "const downloadedFiles = await Promise.all(fontFiles.map(async ({ googleFontFileUrl, preloadFontFile }) => {\n" +
      "            const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];\n";
    const patched = patchLoaderSource(crashed);
    assert.equal(patched.includes("preloadFontFile, ext"), true);
    assert.equal(patched.includes(".exec(googleFontFileUrl)[1]"), false);
    assert.equal(patchLoaderSource(patched), patched);
  });

  it("assigns woff2 when Google omits the file extension", () => {
    applyNextGoogleFontPatch();
    const { findFontFilesInCss } = require(
      path.join(googleFontDir, "find-font-files-in-css.js"),
    );
    const css = `/* latin */
@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/l/font?kit=abc&skey=def) format('woff2');
}`;
    const files = findFontFilesInCss(css, ["latin"]);
    assert.equal(files.length, 1);
    assert.equal(files[0].ext, "woff2");
    assert.equal(files[0].preloadFontFile, true);
    assert.equal(
      files[0].googleFontFileUrl,
      "https://fonts.gstatic.com/l/font?kit=abc&skey=def",
    );
  });

  it("still reads the extension from a normal gstatic pathname", () => {
    applyNextGoogleFontPatch();
    const { findFontFilesInCss } = require(
      path.join(googleFontDir, "find-font-files-in-css.js"),
    );
    const css = `/* latin */
@font-face {
  src: url(https://fonts.gstatic.com/s/ibmplexsans/v22/file.woff2) format('woff2');
}`;
    const files = findFontFilesInCss(css, ["latin"]);
    assert.equal(files[0].ext, "woff2");
  });
});
