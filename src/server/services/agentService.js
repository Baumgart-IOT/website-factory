import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../config/paths.js";
import { listProjectBackups } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import { containsForbiddenConfigKey, normalizeProjectConfig } from "../validation/configValidation.js";
import { pageOutputPath } from "../rendering/pageRenderer.js";
import { normalizeProjectContent } from "./contentService.js";
import { getUsedAssetReferences } from "./mediaService.js";

export async function runAgent(projectId, agentName) {
  const project = await getProject(projectId);
  const config = normalizeProjectConfig(project);
  const result = await checks[agentName](project, config);

  project.agents[agentName] = {
    label: labelFor(agentName),
    status: result.blockingIssues.length ? "attention" : "pass",
    lastRun: new Date().toISOString(),
    blockingIssues: result.blockingIssues,
    warnings: result.warnings,
    recommendations: result.recommendations,
    detail: result.blockingIssues.length ? "Issues need review." : "Placeholder checks passed."
  };
  project.updatedAt = project.agents[agentName].lastRun;
  await saveProject(project);
  return project.agents[agentName];
}

const checks = {
  recon: async (_project, config) => ({
    blockingIssues: [
      !config.business.name && "Business name is missing.",
      !config.business.industry && "Industry is missing.",
      (!config.pages || config.pages.length === 0) && "Pages are missing.",
      !config.business.tagline && "Tagline is missing."
    ].filter(Boolean),
    warnings: config.pages.length < 4 ? ["Consider adding About, Services, FAQ, or Case Studies pages."] : [],
    recommendations: [
      "Suggested pages: Home, Services, About, FAQ, Contact.",
      "Suggested content sections: hero, proof points, services, testimonials, FAQ, contact.",
      `SEO direction: target ${config.business.industry || "industry"} search intent with local and service-specific pages.`,
      `Design direction: use ${config.branding.primaryColor} as the trust colour and ${config.branding.accentColor} for calls to action.`
    ]
  }),
  security: async (_project, config) => ({
    blockingIssues: containsForbiddenConfigKey(config) ? ["Config contains a forbidden secret-like key."] : [],
    warnings: [
      "Contact forms should add spam filtering and rate limiting before production.",
      "SVG uploads must remain sanitized or strictly controlled."
    ],
    recommendations: [
      "Upload validation currently limits logos to PNG and controlled SVG files.",
      "Dangerous upload types are blocked by MIME and signature checks.",
      "Keep secrets in environment variables or a managed secret store, not project JSON."
    ]
  }),
  verify: verifyBuildOutput,
  backup: async (project) => {
    const backups = await listProjectBackups(project.id);
    const latest = backups[0];
    return {
      blockingIssues: backups.length === 0 ? ["No backups exist yet."] : [],
      warnings: latest && (!latest.backupId || !latest.createdAt || !latest.reason) ? ["Latest backup metadata is incomplete."] : [],
      recommendations: [
        "Rollback endpoint is available at POST /api/projects/:id/rollback/:backupId.",
        "Create backups before deployment actions in future phases."
      ]
    };
  }
};

async function verifyBuildOutput(project, config) {
  const latest = project.builds?.[0];
  const warnings = [];
  const blockingIssues = [
    !config.business.name && "Business name is required.",
    !config.template.selected && "Template selection is required.",
    (!config.pages || config.pages.length === 0) && "At least one page is required.",
    !latest && "No build exists yet.",
    latest && !latest.previewPath && "Latest build does not have a preview path.",
    !config.seo.title && "SEO title is missing.",
    !config.seo.description && "SEO description is missing."
  ].filter(Boolean);

  if (latest) {
    const buildDir = join(paths.previews, project.id, latest.buildId);
    const requiredFiles = ["index.html", "styles.css", "sitemap.xml", "robots.txt"];
    for (const file of requiredFiles) {
      if (!(await exists(join(buildDir, file)))) blockingIssues.push(`Generated ${file} is missing.`);
    }

    const content = normalizeProjectContent(project);
    for (const page of Object.values(content.pages)) {
      const output = pageOutputPath(page);
      if (!(await exists(join(buildDir, output)))) blockingIssues.push(`Configured page output is missing: ${output}.`);
    }

    const index = await readText(join(buildDir, "index.html"));
    if (index && !index.includes('class="nav"')) blockingIssues.push("Navigation links are not generated.");
    if (config.features?.contactForm && index && !index.includes('id="contact"')) blockingIssues.push("Contact section is missing.");

    const mediaCheck = checkMediaReferences(project, index);
    blockingIssues.push(...mediaCheck.blockingIssues);
    warnings.push(...mediaCheck.warnings);
  }

  return {
    blockingIssues,
    warnings,
    recommendations: [
      "Open the preview URL manually for visual QA.",
      "Add automated accessibility, link, and responsive checks in the next phase."
    ]
  };
}

function checkMediaReferences(project, indexHtml) {
  const blockingIssues = [];
  const warnings = [];
  const assets = project.media?.assets || [];

  // Don't fail old projects that have no media library entries and no media references.
  const references = getUsedAssetReferences(project);
  if (assets.length === 0 && references.length === 0) {
    return { blockingIssues, warnings };
  }

  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const assetByUrl = new Map(assets.map((asset) => [asset.url, asset]));

  for (const asset of assets) {
    if (!asset.validation || typeof asset.validation.status !== "string") {
      warnings.push(`Media asset ${asset.originalName || asset.assetId} is missing upload validation metadata.`);
    }
  }

  for (const reference of references) {
    const isProjectMediaUrl = typeof reference.url === "string" && reference.url.startsWith(`/uploads/projects/${project.id}/`);
    const matchedAsset = (reference.assetId && assetById.get(reference.assetId)) || (reference.url && assetByUrl.get(reference.url));

    if (reference.assetId && !assetById.has(reference.assetId)) {
      blockingIssues.push(`${reference.location} references a media asset that no longer exists in the media library.`);
      continue;
    }

    if (!matchedAsset && isProjectMediaUrl) {
      blockingIssues.push(`${reference.location} points to an uploaded media file that is missing from the media library: ${reference.url}.`);
      continue;
    }

    if (matchedAsset && indexHtml && reference.location.startsWith("content.pages.home") && !indexHtml.includes(matchedAsset.url)) {
      warnings.push(`${reference.location} is set but the generated home page preview does not include ${matchedAsset.url}.`);
    }
  }

  if (project.config?.branding?.logoAssetId && indexHtml) {
    const logoAsset = assetById.get(project.config.branding.logoAssetId);
    if (logoAsset && !indexHtml.includes(logoAsset.url)) {
      warnings.push("Selected logo asset is configured but was not found in the generated preview header.");
    }
  }

  return { blockingIssues, warnings };
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readText(target) {
  try {
    return await readFile(target, "utf8");
  } catch {
    return "";
  }
}

function labelFor(agentName) {
  return {
    recon: "Recon",
    security: "Security",
    verify: "Verify",
    backup: "Backup"
  }[agentName];
}
