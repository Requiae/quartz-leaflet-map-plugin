import { readFile, writeFile } from "fs/promises";
import { transpileModule, ModuleKind } from "typescript";
import { transform } from "esbuild";

function tsCompile(source: string): string {
  return transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      removeComments: true,
      allowSyntheticDefaultImports: true,
    },
  }).outputText;
}

async function buildSource(): Promise<void> {
  const coreFile = (await readFile("./src/core.ts")).toString();

  const inlineCss = (await readFile("./src/inline.css")).toString();
  const compiledCss = (
    await transform(inlineCss, {
      loader: "css",
      minify: true,
    })
  ).code.replaceAll(/\n/g, "");

  const inlineTs = (await readFile("./src/inline.ts")).toString();
  const compiledJS = (
    await transform(tsCompile(inlineTs), {
      charset: "utf8",
      loader: "js",
      minify: true,
    })
  ).code
    // Escape string literals as those cause issues after compilation
    .replaceAll(/`/g, "\\`")
    .replaceAll(/\$/g, "\\$")
    // Remove redundant whitespace from inline HTML
    .replaceAll(/\s\s+/g, " ")
    .replaceAll(/\n/g, "");

  const buildString = coreFile
    .replace("// @ts-ignore", "")
    .replace("INLINE_CSS_SOURCE", compiledCss)
    .replace("INLINE_JS_SOURCE", compiledJS);

  await writeFile("leafletMapPlugin.ts", buildString, "utf8");
}

await buildSource();
