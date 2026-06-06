import crypto from "node:crypto";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { listJsonFiles, readJsonFile, readProject, writeJsonAtomic, writeProject } from "../storage/jsonStore.js";
import { normalizeProjectConfig, syncProjectFromConfig } from "../validation/configValidation.js";

export async function createProjectBackup(projectOrId, reason = "manual") {
  const project = typeof projectOrId === "string" ? await readProject(projectOrId) : projectOrId;
  if (!project) throwNotFound("Project not found.");

  const backup = {
    backupId: crypto.randomUUID(),
    projectId: project.id,
    createdAt: new Date().toISOString(),
    reason,
    projectSnapshot: structuredClone(project),
    configSnapshot: normalizeProjectConfig(project)
  };

  await writeJsonAtomic(backupPath(project.id, backup.backupId), backup);
  return backup;
}

export async function listProjectBackups(projectId) {
  const folder = backupFolder(projectId);
  const files = await listJsonFiles(folder);
  const backups = await Promise.all(files.map((file) => readJsonFile(join(folder, file))));
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function rollbackProject(projectId, backupId) {
  const current = await readProject(projectId);
  if (!current) throwNotFound("Project not found.");

  const backup = await readBackup(projectId, backupId);
  await createProjectBackup(current, `pre-rollback:${backupId}`);

  const restored = syncProjectFromConfig(structuredClone(backup.projectSnapshot));
  restored.id = projectId;
  restored.updatedAt = new Date().toISOString();
  restored.rollback = {
    restoredFrom: backupId,
    restoredAt: restored.updatedAt
  };

  await writeProject(restored);
  return {
    status: "rolled-back",
    projectId,
    backupId,
    restoredAt: restored.updatedAt,
    project: restored
  };
}

async function readBackup(projectId, backupId) {
  try {
    return await readJsonFile(backupPath(projectId, backupId));
  } catch (error) {
    if (error.code === "ENOENT") throwNotFound("Backup not found.");
    throw error;
  }
}

function backupFolder(projectId) {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throwNotFound("Invalid project id.");
  return join(paths.backups, projectId);
}

function backupPath(projectId, backupId) {
  if (!/^[a-zA-Z0-9-]+$/.test(backupId)) throwNotFound("Invalid backup id.");
  return join(backupFolder(projectId), `${backupId}.json`);
}

function throwNotFound(message) {
  const error = new Error(message);
  error.statusCode = message.includes("Invalid") ? 400 : 404;
  error.publicMessage = message;
  throw error;
}
