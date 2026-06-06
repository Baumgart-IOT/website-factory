import crypto from "node:crypto";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { createProjectBackup } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import { normalizeProjectConfig, validateBuildConfig } from "../validation/configValidation.js";
import { writeJsonAtomic } from "../storage/jsonStore.js";
import { renderProjectPreview } from "../rendering/renderer.js";

export async function buildProject(projectId) {
  const project = await getProject(projectId);
  const config = normalizeProjectConfig(project);
  validateBuildConfig(config);
  await createProjectBackup(project, "pre-build");

  const now = new Date().toISOString();
  const buildId = `build_${crypto.randomUUID()}`;
  const rendered = await renderProjectPreview({ project: { ...project, config }, buildId });
  const build = {
    buildId,
    projectId: project.id,
    status: "success",
    createdAt: now,
    previewPath: rendered.previewPath,
    generatedFiles: rendered.generatedFiles,
    logs: [
      "Validated required project config.",
      "Created pre-build backup.",
      ...rendered.logs,
      "Stored preview metadata record."
    ]
  };

  await writeJsonAtomic(join(paths.builds, project.id, `${buildId}.json`), build);

  project.updatedAt = now;
  project.config = config;
  project.builds = [build, ...(project.builds || [])];
  project.agents.verify = {
    ...project.agents.verify,
    status: "queued",
    detail: "New preview is ready for verification."
  };
  await saveProject(project);

  return { build, project };
}

export async function listProjectBuilds(projectId) {
  const project = await getProject(projectId);
  return project.builds || [];
}
