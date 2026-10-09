/**
 * Sync the repo-root `shared/fixtures/*.json` (the single source of truth for
 * sample data — also consumed by the backend seeder) into the app's src tree.
 * Turbopack cannot import modules from outside the frontend root, so the mock
 * layer imports this generated copy instead. Runs before dev/build/start/smoke.
 */

import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "..", "shared", "fixtures");
const DEST = join(process.cwd(), "src", "mock", "fixtures");

mkdirSync(DEST, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".json"));
for (const file of files) {
  copyFileSync(join(SRC, file), join(DEST, file));
}
console.log(`synced ${files.length} fixture files → src/mock/fixtures`);
