import crypto from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { getProject, saveProject } from "./projectService.js";

const supportedKinds = new Set(["image", "logo", "favicon"]);

export async function listMedia(projectId) {
  const project = await getProject(projectId);
  return project.media?.assets || [];
}

export async function getMediaAsset(projectId, assetId) {
  const project = await getProject(projectId);
  const asset = findAsset(project, assetId);
  if (!asset) throwNotFound("Media asset not found.");
  return asset;
}

export async function ensureProjectUploadDir(projectId) {
  const dir = projectUploadDir(projectId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function addMediaAsset(projectId, fileInfo, options = {}) {
  const project = await getProject(projectId);
  await ensureProjectUploadDir(projectId);

  const kind = supportedKinds.has(options.kind || fileInfo.kind) ? (options.kind || fileInfo.kind) : "image";
  const storedName = await uniqueStoredName(projectId, fileInfo.normalizedExtension);
  const target = join(projectUploadDir(projectId), storedName);
  await writeFile(target, fileInfo.buffer);

  const url = `/uploads/projects/${projectId}/${storedName}`;
  const asset = {
    assetId: `asset_${crypto.randomUUID()}`,
    projectId,
    originalName: fileInfo.originalName,
    storedName,
    mimeType: fileInfo.mimeType,
    extension: fileInfo.normalizedExtension,
    sizeBytes: fileInfo.buffer.length,
    url,
    thumbnailUrl: url,
    kind,
    usage: [],
    uploadedAt: new Date().toISOString(),
    validation: {
      status: fileInfo.validation?.warnings?.length ? "warning" : "pass",
      warnings: fileInfo.validation?.warnings || []
    }
  };

  project.media = project.media || { assets: [] };
  project.media.assets = [asset, ...project.media.assets];
  project.updatedAt = asset.uploadedAt;
  await saveProject(project);
  return { asset, project };
}

export async function deleteMediaAsset(projectId, assetId, options = {}) {
  const project = await getProject(projectId);
  const asset = findAsset(project, assetId);
  if (!asset) throwNotFound("Media asset not found.");

  if (!options.force) {
    const usages = getUsedAssetReferences(project).filter((reference) => referencesAsset(reference, asset));
    if (usages.length) {
      const error = new Error(
        `Asset is currently in use and cannot be deleted: ${usages.map((usage) => usage.location).join(", ")}. Pass force=true to delete anyway.`
      );
      error.statusCode = 409;
      error.publicMessage = error.message;
      error.usages = usages;
      throw error;
    }
  }

  project.media.assets = project.media.assets.filter((item) => item.assetId !== assetId);
  await rm(join(projectUploadDir(projectId), asset.storedName), { force: true });
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return { status: "deleted", assetId, project };
}

export function resolveAssetUrl(projectId, assetId) {
  return `/uploads/projects/${projectId}/${assetId}`;
}

export function getUsedAssetReferences(project) {
  const references = [];
  const branding = project.config?.branding || {};

  if (branding.logoAssetId || branding.logoUrl) {
    references.push({ assetId: branding.logoAssetId || null, url: branding.logoUrl || null, location: "branding.logoUrl" });
  }
  if (branding.faviconAssetId || branding.faviconUrl) {
    references.push({ assetId: branding.faviconAssetId || null, url: branding.faviconUrl || null, location: "branding.faviconUrl" });
  }

  const content = project.content;
  if (content && typeof content === "object" && content.pages && typeof content.pages === "object") {
    for (const [pageKey, page] of Object.entries(content.pages)) {
      for (const section of page?.sections || []) {
        collectImageReferences(section?.content, `content.pages.${pageKey}.sections.${section?.id}`, references);
      }
    }
  }

  return references;
}

export function isAssetInUse(project, asset) {
  return getUsedAssetReferences(project).some((reference) => referencesAsset(reference, asset));
}

export function getMediaUsageReport(project) {
  const assets = project.media?.assets || [];
  const references = getUsedAssetReferences(project);
  return assets.map((asset) => ({
    assetId: asset.assetId,
    url: asset.url,
    usage: references.filter((reference) => referencesAsset(reference, asset)).map((reference) => reference.location)
  }));
}

export function markAssetUsage(project, assetId, location) {
  const asset = findAsset(project, assetId);
  if (!asset) return null;
  asset.usage = Array.from(new Set([...(asset.usage || []), location]));
  return asset;
}

export function normalizeFilename(originalName) {
  const base = String(originalName || "asset").split(/[\\/]/).pop();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "asset";
}

function findAsset(project, assetId) {
  return (project.media?.assets || []).find((item) => item.assetId === assetId);
}

function referencesAsset(reference, asset) {
  if (reference.assetId && reference.assetId === asset.assetId) return true;
  if (reference.url && asset.url && reference.url === asset.url) return true;
  return false;
}

function collectImageReferences(value, path, references, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === "string") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageReferences(item, `${path}[${index}]`, references, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (/^(image|logo|favicon)?url$/i.test(key) && typeof nested === "string" && nested.startsWith("/uploads/projects/")) {
      references.push({ assetId: null, url: nested, location: `${path}.${key}` });
    }
    collectImageReferences(nested, `${path}.${key}`, references, depth + 1);
  }
}

function projectUploadDir(projectId) {
  return join(paths.uploads, "projects", projectId);
}

async function uniqueStoredName(projectId, extension) {
  const dir = projectUploadDir(projectId);
  await mkdir(dir, { recursive: true });
  const existing = new Set(await readdir(dir).catch(() => []));
  let candidate;
  do {
    candidate = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
  } while (existing.has(candidate));
  return candidate;
}

function throwNotFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.publicMessage = message;
  throw error;
}
