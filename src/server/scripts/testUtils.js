import { rm } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { readProjects } from "../storage/jsonStore.js";

export async function cleanupSmokeProjects(prefix) {
  const normalizedPrefix = String(prefix || "").toLowerCase();
  if (!normalizedPrefix.startsWith("smoke-")) throw new Error("Smoke cleanup prefix must start with smoke-.");

  const projects = await readProjects();
  const removed = [];
  for (const project of projects) {
    const name = String(project.config?.business?.name || project.site?.name || "").toLowerCase();
    if (!name.startsWith(normalizedPrefix)) continue;
    await removeProjectArtifacts(project.id);
    removed.push(project.id);
  }
  return removed;
}

export async function removeProjectArtifacts(projectId) {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throw new Error("Invalid smoke project id.");
  await Promise.all([
    rm(join(paths.projects, `${projectId}.json`), { force: true }),
    rm(join(paths.backups, projectId), { recursive: true, force: true }),
    rm(join(paths.builds, projectId), { recursive: true, force: true }),
    rm(join(paths.previews, projectId), { recursive: true, force: true })
  ]);
}
