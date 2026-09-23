#!/usr/bin/env bun
/**
 * generate-schema.ts
 *
 * Generates JSON Schema from TypeScript type definitions.
 * This allows YAML configs to be validated by editors.
 *
 * Usage: bun agent/tools/config/generate-schema.ts
 */

import { resolve, dirname } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { createGenerator, type Config } from "ts-json-schema-generator";

const __dirname = dirname(new URL(import.meta.url).pathname);

const config: Config = {
  path: resolve(__dirname, "schemas/writing-config.schema.ts"),
  tsconfig: resolve(__dirname, "../../../tsconfig.json"),
  type: "WritingConfig",
  skipTypeCheck: true,
};

try {
  console.log("Generating JSON Schema from TypeScript types...");
  console.log(`  Source: ${config.path}`);
  console.log(`  Type: ${config.type}`);

  const generator = createGenerator(config);
  const schema = generator.createSchema(config.type);

  // Add metadata
  schema.$id = "https://writing-skill.local/writing-config.schema.json";
  schema.title = "Writing Configuration";
  schema.description =
    "Writing configuration with author context, writing style, and rule thresholds";

  // Output path
  const outputPath = resolve(__dirname, "writing-config.schema.json");

  writeFileSync(outputPath, JSON.stringify(schema, null, 2));

  console.log(`\nGenerated: ${outputPath}`);
  console.log("Done!");
} catch (error) {
  console.error("Error generating schema:", error);
  process.exit(1);
}
