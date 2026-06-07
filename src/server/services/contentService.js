import { createProjectBackup } from "./backupService.js";
import { getProject, saveProject } from "./projectService.js";
import { normalizeProjectConfig } from "../validation/configValidation.js";
import {
  safePageKey,
  slugFromTitle,
  validateContent,
  validateContentPatch,
  validateNewPage,
  validateNewSection,
  validatePagePatch,
  validateSectionPatch
} from "../validation/contentValidation.js";

export async function getProjectContent(projectId) {
  const project = await getProject(projectId);
  return { project, content: normalizeProjectContent(project) };
}

export async function initializeProjectContent(projectId, options = {}) {
  const project = await getProject(projectId);
  if (project.content && !options.force) return { project, content: normalizeProjectContent(project), initialized: false };
  await createProjectBackup(project, "pre-content-initialize");
  project.content = seedContentFromConfig(project);
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return { project, content: project.content, initialized: true };
}

export async function patchProjectContent(projectId, patch) {
  validateContentPatch(patch);
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const next = {
    ...content,
    ...patch,
    pages: patch.pages ? patch.pages : content.pages
  };
  validateContent(next);
  await mutateContent(project, next, "pre-content-patch");
  return { project, content: project.content };
}

export async function addContentPage(projectId, input) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const page = validateNewPage(input);
  if (content.pages[page.key]) throwPublic(400, "Page key already exists.");
  if (Object.values(content.pages).some((existing) => existing.slug === page.value.slug)) throwPublic(400, "Page slug already exists.");
  content.pages[page.key] = page.value;
  await mutateContent(project, content, "pre-content-add-page");
  return { project, content, pageKey: page.key, page: page.value };
}

export async function patchContentPage(projectId, pageKey, patch) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  requirePage(content, pageKey);
  validatePagePatch(patch);
  const nextPage = { ...content.pages[pageKey], ...patch, seo: { ...content.pages[pageKey].seo, ...(patch.seo || {}) } };
  if (patch.slug && Object.entries(content.pages).some(([key, page]) => key !== pageKey && page.slug === patch.slug)) throwPublic(400, "Page slug already exists.");
  content.pages[pageKey] = nextPage;
  validateContent(content);
  await mutateContent(project, content, "pre-content-patch-page");
  return { project, content, pageKey, page: nextPage };
}

export async function deleteContentPage(projectId, pageKey) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  requirePage(content, pageKey);
  if (Object.keys(content.pages).length <= 1) throwPublic(400, "Cannot delete the last remaining page.");
  if (pageKey === "home") throwPublic(400, "Cannot delete the home page unless another page is assigned as home.");
  delete content.pages[pageKey];
  await mutateContent(project, content, "pre-content-delete-page");
  return { project, content };
}

export async function addContentSection(projectId, pageKey, input) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const page = requirePage(content, pageKey);
  const section = validateNewSection({ ...input, order: input?.order ?? nextOrder(page.sections) });
  if (page.sections.some((existing) => existing.id === section.id)) throwPublic(400, "Section id already exists on this page.");
  page.sections.push(section);
  sortSections(page);
  validateContent(content);
  await mutateContent(project, content, "pre-content-add-section");
  return { project, content, section };
}

export async function patchContentSection(projectId, pageKey, sectionId, patch) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const page = requirePage(content, pageKey);
  const section = requireSection(page, sectionId);
  validateSectionPatch(patch);
  Object.assign(section, patch);
  if (patch.content) section.content = patch.content;
  sortSections(page);
  validateContent(content);
  await mutateContent(project, content, "pre-content-patch-section");
  return { project, content, section };
}

export async function deleteContentSection(projectId, pageKey, sectionId) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const page = requirePage(content, pageKey);
  requireSection(page, sectionId);
  page.sections = page.sections.filter((section) => section.id !== sectionId);
  await mutateContent(project, content, "pre-content-delete-section");
  return { project, content };
}

export async function moveContentSection(projectId, pageKey, sectionId, input) {
  const project = await getProject(projectId);
  const content = normalizeProjectContent(project);
  const page = requirePage(content, pageKey);
  const section = requireSection(page, sectionId);
  const direction = input?.direction;
  const sorted = [...page.sections].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((item) => item.id === section.id);
  const targetIndex = direction === "up" ? index - 1 : direction === "down" ? index + 1 : -1;
  if (targetIndex < 0 || targetIndex >= sorted.length) return { project, content, section };
  const target = sorted[targetIndex];
  const oldOrder = section.order;
  section.order = target.order;
  target.order = oldOrder;
  sortSections(page);
  await mutateContent(project, content, "pre-content-move-section");
  return { project, content, section };
}

export function normalizeProjectContent(project) {
  if (project.content?.pages) {
    const content = structuredClone(project.content);
    validateContent(content);
    return content;
  }
  return seedContentFromConfig(project);
}

export function seedContentFromConfig(project) {
  const config = normalizeProjectConfig(project);
  const pages = {};
  for (const pageTitle of config.pages || ["Home", "Contact"]) {
    const key = safePageKey(pageTitle);
    pages[key] = {
      title: pageTitle,
      slug: key === "home" ? "/" : slugFromTitle(pageTitle),
      seo: {
        title: key === "home" ? config.seo.title : `${pageTitle} | ${config.business.name}`,
        description: config.seo.description
      },
      sections: defaultSectionsForPage(key, config)
    };
  }
  if (!pages.home) {
    pages.home = {
      title: "Home",
      slug: "/",
      seo: { title: config.seo.title, description: config.seo.description },
      sections: defaultSectionsForPage("home", config)
    };
  }
  return validateContent({ pages });
}

function defaultSectionsForPage(pageKey, config) {
  const base = [];
  const push = (type, content = {}) => base.push({ id: `${safePageKey(type)}-${base.length + 1}`, type, enabled: true, order: base.length + 1, content });
  push("hero", {
    eyebrow: config.business.industry,
    heading: pageKey === "home" ? config.business.name : titleFromKey(pageKey),
    subheading: config.business.tagline,
    primaryButtonText: "Start a conversation",
    primaryButtonUrl: "/contact",
    secondaryButtonText: "View services",
    secondaryButtonUrl: "/services"
  });
  if (pageKey === "home") {
    push("services", { heading: `Services for ${config.business.industry}`, subheading: "Focused offers shaped around your audience." });
    push("process", { heading: "How we work" });
    if (config.features.testimonials) push("testimonials", { heading: "What clients value" });
    if (config.features.faq) push("faq", { heading: "Common questions" });
    push("cta", { heading: `Ready to work with ${config.business.name}?`, buttonText: "Contact us", buttonUrl: "/contact" });
    if (config.features.contactForm) push("contact", { heading: "Contact", email: config.business.email, phone: config.business.phone, address: config.business.address });
  } else if (pageKey.includes("service")) {
    push("services", { heading: `Services for ${config.business.industry}` });
    push("process", { heading: "Service process" });
    if (config.features.quoteRequest) push("quote_request", { heading: "Request a quote" });
  } else if (pageKey.includes("about")) {
    push("about", { heading: `About ${config.business.name}` });
    push("process", { heading: "How we think" });
  } else if (pageKey.includes("contact")) {
    push("contact", { heading: "Contact", email: config.business.email, phone: config.business.phone, address: config.business.address });
    if (config.features.quoteRequest) push("quote_request", { heading: "Request a quote" });
  } else {
    push("about", { heading: titleFromKey(pageKey) });
    push("cta", { heading: "Take the next step", buttonText: "Contact us", buttonUrl: "/contact" });
  }
  return base;
}

async function mutateContent(project, content, reason) {
  validateContent(content);
  await createProjectBackup(project, reason);
  project.content = content;
  project.config.pages = Object.values(content.pages).map((page) => page.title);
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

function requirePage(content, pageKey) {
  if (!content.pages[pageKey]) throwPublic(404, "Content page not found.");
  return content.pages[pageKey];
}

function requireSection(page, sectionId) {
  const section = page.sections.find((item) => item.id === sectionId);
  if (!section) throwPublic(404, "Content section not found.");
  return section;
}

function sortSections(page) {
  page.sections.sort((a, b) => a.order - b.order);
  page.sections.forEach((section, index) => {
    section.order = index + 1;
  });
}

function nextOrder(sections) {
  return Math.max(0, ...sections.map((section) => Number(section.order) || 0)) + 1;
}

function titleFromKey(key) {
  return key.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function throwPublic(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}
