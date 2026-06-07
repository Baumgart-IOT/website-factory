import { createProjectBackup } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import {
  addMediaAsset,
  deleteMediaAsset,
  getMediaAsset,
  getMediaUsageReport,
  listMedia,
  markAssetUsage
} from "./mediaService.js";
import { parseMultipartMedia } from "../validation/uploadValidation.js";

const MAX_IMAGE_BYTES = Number.parseInt(process.env.MAX_IMAGE_BYTES || String(5 * 1024 * 1024), 10);
const MAX_FAVICON_BYTES = Number.parseInt(process.env.MAX_FAVICON_BYTES || String(1 * 1024 * 1024), 10);

export async function listProjectMedia(projectId) {
  const project = await getProject(projectId);
  return { project, assets: await listMedia(projectId) };
}

export async function getProjectMediaAsset(projectId, assetId) {
  const asset = await getMediaAsset(projectId, assetId);
  return { asset };
}

export async function uploadProjectMedia(req, projectId, requestedKind) {
  const project = await getProject(projectId);
  const kind = ["image", "logo", "favicon"].includes(requestedKind) ? requestedKind : "image";
  const maxBytes = kind === "favicon" ? MAX_FAVICON_BYTES : MAX_IMAGE_BYTES;

  const file = await parseMultipartMedia(req, { fieldName: "file", kind, maxBytes });
  await createProjectBackup(project, "pre-media-upload");

  const { asset, project: updated } = await addMediaAsset(projectId, file, { kind });
  return { asset, project: updated };
}

export async function deleteProjectMedia(projectId, assetId, options = {}) {
  const project = await getProject(projectId);
  await createProjectBackup(project, "pre-media-delete");
  return deleteMediaAsset(projectId, assetId, options);
}

export async function getProjectMediaUsage(projectId) {
  const project = await getProject(projectId);
  return { usage: getMediaUsageReport(project) };
}

export async function markProjectMediaUsage(projectId, assetId, location) {
  const project = await getProject(projectId);
  const asset = await getMediaAsset(projectId, assetId);
  markAssetUsage(project, asset.assetId, String(location || "manual"));
  await saveProject(project);
  return { asset };
}
