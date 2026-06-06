import { listProjectBackups } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import { containsForbiddenConfigKey, normalizeProjectConfig } from "../validation/configValidation.js";

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
  verify: async (project, config) => ({
    blockingIssues: [
      !config.business.name && "Business name is required.",
      !config.template.selected && "Template selection is required.",
      (!config.pages || config.pages.length === 0) && "At least one page is required.",
      (!project.builds || project.builds.length === 0) && "No build exists yet.",
      project.builds?.[0] && !project.builds[0].previewPath && "Latest build does not have a preview path.",
      !config.seo.title && "SEO title is missing.",
      !config.seo.description && "SEO description is missing."
    ].filter(Boolean),
    warnings: [],
    recommendations: [
      "Run a manual browser preview check after each successful build.",
      "Add automated accessibility and responsive checks in the next phase."
    ]
  }),
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

function labelFor(agentName) {
  return {
    recon: "Recon",
    security: "Security",
    verify: "Verify",
    backup: "Backup"
  }[agentName];
}
