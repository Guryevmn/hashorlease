// Позволяет запускать серверные скрипты на TypeScript без сборки: node --import ./scripts/register-ts.mjs scripts/agent.ts
// Node 22.18+ сам убирает типы; здесь только разрешение путей «@/…» и импортов без расширения, как в Next.js.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
