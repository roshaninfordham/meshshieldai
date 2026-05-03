import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/snapshot.schema.json"), "utf8"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/snapshot.json"), "utf8"));

describe("Snapshot ts roundtrip", () => {
  it("validates the same fixture the Python side validates", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    // Remove the $schema reference to avoid schema resolution issues
    const schemaWithoutMeta = { ...schema };
    delete schemaWithoutMeta.$schema;
    const validate = ajv.compile(schemaWithoutMeta);
    expect(validate(fixture)).toBe(true);
  });
});
