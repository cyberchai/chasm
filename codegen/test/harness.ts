// Standalone test harness for @chasm/codegen — develop without the orchestrator.
//
//   npm run codegen:build demo [--skip-install] [--skip-vite]
//   npm run codegen:edit  demo "make the hero bigger"
//   npm run codegen:edit  demo "see whiteboard" --whiteboard ./test/fixtures/wb.png
//
// `build` copies test/fixtures/profile.json into data/<id>/profile.json and
// clones the fixture template (override with CHASM_TEMPLATE=/path/to/template).

import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { buildInitialSite } from "../src/buildInitial.js";
import { applyEdit } from "../src/applyEdit.js";
import { dataDir, profilePath } from "../src/paths.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const FIXTURE_PROFILE = join(FIXTURES, "profile.json");
const FIXTURE_TEMPLATE = join(FIXTURES, "template");

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function optionValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const [cmd, businessId, ...rest] = process.argv.slice(2);

  if (!cmd || !businessId) {
    console.error(
      'usage: harness.ts build <id> [--skip-install] [--skip-vite]\n' +
        '       harness.ts edit  <id> "<instruction>" [--whiteboard <png>]',
    );
    process.exit(1);
  }

  if (cmd === "build") {
    await mkdir(dataDir(businessId), { recursive: true });
    await copyFile(FIXTURE_PROFILE, profilePath(businessId));
    const res = await buildInitialSite(businessId, {
      templateDir: process.env.CHASM_TEMPLATE ?? FIXTURE_TEMPLATE,
      skipInstall: flag("skip-install"),
      skipVite: flag("skip-vite"),
    });
    console.log(res);
    process.exit(res.ok ? 0 : 1);
  }

  if (cmd === "edit") {
    const instruction = rest.find((a) => !a.startsWith("--")) ?? "";
    if (!instruction) {
      console.error('edit needs an instruction, e.g. edit demo "make it darker"');
      process.exit(1);
    }
    const res = await applyEdit({
      businessId,
      instruction,
      whiteboardPng: optionValue("whiteboard"),
      currentScreenshot: optionValue("screenshot"),
    });
    console.log(res);
    process.exit(res.ok ? 0 : 1);
  }

  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

void main();
