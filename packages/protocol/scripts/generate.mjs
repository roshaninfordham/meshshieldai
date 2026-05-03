// packages/protocol/scripts/generate.mjs
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const schemasDir = join(pkg, "schemas");
const tsDir = join(pkg, "ts/src");
const pyPkgDir = join(pkg, "python/meshshield_protocol");
mkdirSync(tsDir, { recursive: true });
mkdirSync(pyPkgDir, { recursive: true });

const schemas = readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json"));

// --- TypeScript via json-schema-to-typescript ---
const { compileFromFile } = await import("json-schema-to-typescript");
const tsExports = [];
for (const file of schemas) {
  const ts = await compileFromFile(join(schemasDir, file), {
    bannerComment: "// AUTO-GENERATED FROM packages/protocol/schemas — do not edit",
    additionalProperties: false,
  });
  const outName = basename(file, ".schema.json") + ".ts";
  writeFileSync(join(tsDir, outName), ts);
  // Extract exported names from the generated file so index.ts contains them literally
  const exportedNames = [...ts.matchAll(/^export (?:interface|type) (\w+)/gm)].map(m => m[1]);
  const moduleName = basename(file, ".schema.json");
  if (exportedNames.length > 0) {
    tsExports.push(`export { ${exportedNames.join(", ")} } from "./${moduleName}";`);
  } else {
    tsExports.push(`export * from "./${moduleName}";`);
  }
}
writeFileSync(join(tsDir, "index.ts"), "// AUTO-GENERATED FROM packages/protocol/schemas — do not edit\n" + tsExports.join("\n") + "\n");

// --- Pydantic via datamodel-code-generator (one file per schema, then __init__) ---
for (const file of schemas) {
  const baseName = basename(file, ".schema.json").replaceAll("-", "_");
  const out = join(pyPkgDir, `${baseName}.py`);
  execSync(
    `uv run datamodel-codegen --input "${join(schemasDir, file)}" --input-file-type jsonschema --output "${out}" --output-model-type pydantic_v2.BaseModel --use-schema-description --target-python-version 3.12`,
    { stdio: "inherit" }
  );
}

// __init__.py re-exports the four top-level types under stable names.
const initLines = [
  "# AUTO-GENERATED FROM packages/protocol/schemas — do not edit",
  "from .sensor_message import SensorMessage",
  "from .snapshot import Snapshot",
  "from .response_plan import ResponsePlan",
  "from .agent_event import AgentEvent",
  "__all__ = ['SensorMessage', 'Snapshot', 'ResponsePlan', 'AgentEvent']",
];
writeFileSync(join(pyPkgDir, "__init__.py"), initLines.join("\n") + "\n");

console.log("✓ generated TS in", tsDir);
console.log("✓ generated Pydantic in", pyPkgDir);
