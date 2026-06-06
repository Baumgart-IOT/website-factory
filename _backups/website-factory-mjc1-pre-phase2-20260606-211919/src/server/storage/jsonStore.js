import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDirectories, paths } from "../config/paths.js";

export async function ensureStorage() {
  await ensureDirectories();
}

export async function readProject(id) {
  try {
    return JSON.parse(await readFile(projectPath(id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function readProjects() {
  await ensureStorage();
  const files = await readdir(paths.projects);
  const projects = await Promise.all(
    files.filter((file) => file.endsWith(".json")).map((file) => readFile(join(paths.projects, file), "utf8").then(JSON.parse))
  );
  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function writeProject(project) {
  await ensureStorage();
  const target = projectPath(project.id);
  const temp = `${target}.tmp`;
  await writeFile(temp, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await rename(temp, target);
  return project;
}

function projectPath(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    const error = new Error("Invalid project id.");
    error.statusCode = 400;
    error.publicMessage = "Invalid project id.";
    throw error;
  }
  return join(paths.projects, `${id}.json`);
}
