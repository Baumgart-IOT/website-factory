import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const paths = {
  root: ROOT,
  data: resolve(ROOT, "data"),
  projects: resolve(ROOT, "data/projects"),
  backups: resolve(ROOT, "data/backups"),
  builds: resolve(ROOT, "data/builds"),
  previews: resolve(ROOT, "previews"),
  templates: resolve(ROOT, "templates"),
  uploads: resolve(ROOT, "uploads"),
  logos: resolve(ROOT, "uploads/logos"),
  projectMedia: resolve(ROOT, "uploads/projects")
};

export async function ensureDirectories() {
  await Promise.all([
    mkdir(paths.projects, { recursive: true }),
    mkdir(paths.backups, { recursive: true }),
    mkdir(paths.builds, { recursive: true }),
    mkdir(paths.previews, { recursive: true }),
    mkdir(paths.logos, { recursive: true }),
    mkdir(paths.projectMedia, { recursive: true })
  ]);
}
