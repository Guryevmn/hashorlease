// Хук разрешения модулей для register-ts.mjs: «@/x» → src/x, «./x» → ./x.ts | ./x/index.ts.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function withTsExtension(path) {
  for (const p of [path, `${path}.ts`, `${path}.tsx`, join(path, "index.ts")]) {
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parent = fileURLToPath(context.parentURL);
    if (!parent.includes("/node_modules/")) base = resolvePath(dirname(parent), specifier);
  }
  if (base) {
    const file = withTsExtension(base);
    if (file) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}

// Наши .ts — всегда ES-модули (без предупреждения о типе пакета).
export async function load(url, context, next) {
  if (url.startsWith("file:") && url.endsWith(".ts") && !url.includes("/node_modules/")) {
    return next(url, { ...context, format: "module-typescript" });
  }
  return next(url, context);
}
