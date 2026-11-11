// Lets server-side TypeScript scripts run without a build step: node --import ./scripts/register-ts.mjs scripts/agent.ts
// Node 22.18+ strips types itself; this only resolves "@/…" paths and extensionless imports, as Next.js does.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
