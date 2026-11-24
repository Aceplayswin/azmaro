/**
 * Writes the OpenAPI 3 document (generated from the route definitions) to docs/openapi.json.
 *   npm run docs:openapi
 */
import "../src/load-env";
import { writeFileSync } from "node:fs";
import { createApp } from "../src/app";
import { buildOpenApiDocument } from "../src/docs/registry";

createApp(); // importing the app registers every route's documentation
const doc = buildOpenApiDocument("http://localhost:4000");
writeFileSync("docs/openapi.json", `${JSON.stringify(doc, null, 2)}\n`);
const ops = Object.values(doc.paths).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`✓ docs/openapi.json – ${Object.keys(doc.paths).length} paths, ${ops} operations`);
process.exit(0);
