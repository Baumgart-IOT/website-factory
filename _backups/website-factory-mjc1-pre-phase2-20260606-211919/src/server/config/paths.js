import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const paths = {
  root: ROOT,
  data: resolve(ROOT, "data"),
  projects: resolve(ROOT, "data/projects"),
  templates: resolve(ROOT, "templates"),
  uploads: resolve(ROOT, "uploads"),
  logos: resolve(ROOT, "uploads/logos")
};

export async function ensureDirectories() {
  await Promise.all([
    mkdir(paths.projects, { recursive: true }),
    mkdir(paths.logos, { recursive: true })
  ]);
}
