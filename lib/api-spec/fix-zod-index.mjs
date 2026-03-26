/**
 * Post-codegen fix: Orval in split+zod mode generates an index.ts that
 * re-exports both ./generated/api and ./generated/types, which causes
 * TS2308 duplicate-export errors because query param types appear in both.
 * This script rewrites the index to export only from ./generated/api.
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "../api-zod/src/index.ts");

writeFileSync(indexPath, `export * from "./generated/api";\n`, "utf8");
console.log("Fixed lib/api-zod/src/index.ts");
