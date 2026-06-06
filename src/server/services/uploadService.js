import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { getProject } from "./projectService.js";
import { createProjectBackup } from "./backupService.js";
import { writeProject } from "../storage/jsonStore.js";
import { parseMultipartLogo } from "../validation/uploadValidation.js";

export async function uploadLogo(req, projectId) {
  const project = await getProject(projectId);
  const logo = await parseMultipartLogo(req);
  await createProjectBackup(project, project.assets?.logo ? "pre-logo-replacement" : "pre-logo-upload");
  const extension = logo.contentType === "image/png" ? "png" : "svg";
  const storedName = `${project.id}-${crypto.randomUUID()}.${extension}`;
  const target = join(paths.logos, storedName);

  await writeFile(target, logo.buffer);

  project.assets.logo = {
    originalName: logo.filename,
    storedName,
    contentType: logo.contentType,
    size: logo.buffer.length,
    uploadedAt: new Date().toISOString()
  };
  project.config.branding.logoUrl = `/uploads/logos/${storedName}`;
  project.updatedAt = project.assets.logo.uploadedAt;

  return writeProject(project);
}
