const forbiddenKeys = new Set(["password", "token", "apikey", "secret", "privatekey", "accesstoken", "refreshtoken"]);
const animationLevels = new Set(["none", "subtle", "standard", "expressive"]);
const borderRadii = new Set(["none", "small", "medium", "large"]);

export const defaultFeatures = {
  contactForm: true,
  quoteRequest: false,
  gallery: false,
  blog: false,
  testimonials: true,
  faq: true
};

export function buildDefaultConfig(value, template) {
  return {
    business: {
      name: value.name,
      tagline: value.goal,
      industry: value.industry,
      location: "",
      email: "",
      phone: "",
      address: ""
    },
    branding: {
      logoUrl: "",
      faviconUrl: "",
      logoAssetId: "",
      faviconAssetId: "",
      primaryColor: paletteToPrimary(value.palette),
      accentColor: "#d88c4a",
      backgroundColor: "#fffdfa",
      headingFont: "Inter",
      bodyFont: "Inter",
      darkMode: false,
      borderRadius: "medium"
    },
    template: {
      selected: value.templateId,
      layout: template?.category || "standard",
      animationLevel: "standard"
    },
    pages: value.pages,
    features: { ...defaultFeatures },
    seo: {
      title: value.name,
      description: value.goal,
      keywords: [value.industry].filter(Boolean),
      generateSitemap: true,
      generateRobots: true
    }
  };
}

export function normalizeProjectConfig(project) {
  if (project.config) return mergeConfig(buildDefaultConfigFromProject(project), project.config);
  return buildDefaultConfigFromProject(project);
}

export function validateConfigPatch(patch, templates) {
  const errors = [];
  if (!isPlainObject(patch)) errors.push("Config patch must be an object.");
  if (errors.length) throwValidation(errors);

  detectForbiddenKeys(patch, [], errors);
  const allowedRoot = new Set(["business", "branding", "template", "pages", "features", "seo"]);
  for (const key of Object.keys(patch)) {
    if (!allowedRoot.has(key)) errors.push(`Unsupported config section: ${key}.`);
  }

  if (patch.business !== undefined) validateBusinessPatch(patch.business, errors);
  if (patch.branding !== undefined) validateBrandingPatch(patch.branding, errors);
  if (patch.template !== undefined) validateTemplatePatch(patch.template, templates, errors);
  if (patch.pages !== undefined) validatePages(patch.pages, errors);
  if (patch.features !== undefined) validateFeaturesPatch(patch.features, errors);
  if (patch.seo !== undefined) validateSeoPatch(patch.seo, errors);

  if (errors.length) throwValidation(errors);
  return patch;
}

export function validateBuildConfig(config) {
  const errors = [];
  if (!clean(config.business?.name)) errors.push("Business name is required before building.");
  if (!clean(config.business?.tagline)) errors.push("Tagline is required before building.");
  if (!clean(config.business?.industry)) errors.push("Industry is required before building.");
  if (!clean(config.template?.selected)) errors.push("Template selection is required before building.");
  validatePages(config.pages, errors);
  if (!clean(config.seo?.title)) errors.push("SEO title is required before building.");
  if (!clean(config.seo?.description)) errors.push("SEO description is required before building.");
  if (errors.length) throwValidation(errors);
}

export function mergeConfig(base, patch) {
  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(patch || {})) {
    if (Array.isArray(value)) {
      merged[key] = value.map((item) => (typeof item === "string" ? clean(item) : item));
    } else if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = { ...merged[key], ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function syncProjectFromConfig(project, template = null) {
  const config = normalizeProjectConfig(project);
  project.config = config;
  project.site = {
    ...project.site,
    name: config.business.name,
    slug: project.site?.slug || slugify(config.business.name),
    industry: config.business.industry,
    goal: config.business.tagline,
    audience: project.site?.audience || "Primary customers",
    palette: project.site?.palette || "graphite",
    templateId: config.template.selected,
    templateName: template?.name || project.site?.templateName || config.template.selected,
    pages: config.pages
  };
  return project;
}

export function containsForbiddenConfigKey(value) {
  const errors = [];
  detectForbiddenKeys(value, [], errors);
  return errors.length > 0;
}

function validateBusinessPatch(value, errors) {
  if (!isPlainObject(value)) {
    errors.push("Business config must be an object.");
    return;
  }
  validateString(value, "name", 0, 100, errors);
  validateString(value, "tagline", 0, 240, errors);
  validateString(value, "industry", 0, 100, errors);
  validateString(value, "location", 0, 120, errors);
  validateString(value, "phone", 0, 40, errors);
  validateString(value, "address", 0, 240, errors);
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.push("Email format is invalid.");
}

function validateBrandingPatch(value, errors) {
  if (!isPlainObject(value)) {
    errors.push("Branding config must be an object.");
    return;
  }
  for (const key of ["logoUrl", "faviconUrl", "logoAssetId", "faviconAssetId", "headingFont", "bodyFont"]) validateString(value, key, 0, 160, errors);
  for (const key of ["primaryColor", "accentColor", "backgroundColor"]) {
    if (value[key] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value[key])) errors.push(`${key} must be a valid hex colour.`);
  }
  if (value.darkMode !== undefined && typeof value.darkMode !== "boolean") errors.push("darkMode must be true or false.");
  if (value.borderRadius !== undefined && !borderRadii.has(value.borderRadius)) errors.push("borderRadius is not supported.");
}

function validateTemplatePatch(value, templates, errors) {
  if (!isPlainObject(value)) {
    errors.push("Template config must be an object.");
    return;
  }
  if (value.selected !== undefined && !templates.some((template) => template.id === value.selected)) errors.push("Selected template does not exist.");
  validateString(value, "layout", 0, 80, errors);
  if (value.animationLevel !== undefined && !animationLevels.has(value.animationLevel)) errors.push("Animation level is not supported.");
}

function validatePages(value, errors) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) {
    errors.push("Pages must contain 1-12 entries.");
    return;
  }
  for (const page of value) {
    if (typeof page !== "string" || clean(page).length < 2 || clean(page).length > 60) errors.push("Each page must be a 2-60 character string.");
  }
}

function validateFeaturesPatch(value, errors) {
  if (!isPlainObject(value)) {
    errors.push("Features config must be an object.");
    return;
  }
  for (const [key, setting] of Object.entries(value)) {
    if (!(key in defaultFeatures)) errors.push(`Unsupported feature: ${key}.`);
    if (typeof setting !== "boolean") errors.push(`Feature ${key} must be true or false.`);
  }
}

function validateSeoPatch(value, errors) {
  if (!isPlainObject(value)) {
    errors.push("SEO config must be an object.");
    return;
  }
  validateString(value, "title", 0, 100, errors);
  validateString(value, "description", 0, 220, errors);
  if (value.keywords !== undefined && (!Array.isArray(value.keywords) || value.keywords.some((keyword) => typeof keyword !== "string" || keyword.length > 40))) {
    errors.push("SEO keywords must be an array of short strings.");
  }
  if (value.generateSitemap !== undefined && typeof value.generateSitemap !== "boolean") errors.push("generateSitemap must be true or false.");
  if (value.generateRobots !== undefined && typeof value.generateRobots !== "boolean") errors.push("generateRobots must be true or false.");
}

function validateString(object, key, min, max, errors) {
  if (object[key] === undefined) return;
  const value = clean(object[key]);
  if (value.length < min || value.length > max) errors.push(`${key} must be ${min}-${max} characters.`);
}

function detectForbiddenKeys(value, path, errors) {
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (forbiddenKeys.has(normalized)) errors.push(`Config cannot store secret-like field: ${[...path, key].join(".")}.`);
    detectForbiddenKeys(nested, [...path, key], errors);
  }
}

function buildDefaultConfigFromProject(project) {
  return {
    business: {
      name: project.site?.name || "",
      tagline: project.site?.goal || "",
      industry: project.site?.industry || "",
      location: "",
      email: "",
      phone: "",
      address: ""
    },
    branding: {
      logoUrl: project.assets?.logo?.storedName ? `/uploads/logos/${project.assets.logo.storedName}` : "",
      faviconUrl: "",
      logoAssetId: "",
      faviconAssetId: "",
      primaryColor: paletteToPrimary(project.site?.palette),
      accentColor: "#d88c4a",
      backgroundColor: "#fffdfa",
      headingFont: "Inter",
      bodyFont: "Inter",
      darkMode: false,
      borderRadius: "medium"
    },
    template: {
      selected: project.site?.templateId || "",
      layout: project.site?.templateName || "",
      animationLevel: "standard"
    },
    pages: project.site?.pages || ["Home", "Contact"],
    features: { ...defaultFeatures },
    seo: {
      title: project.site?.name || "",
      description: project.site?.goal || "",
      keywords: [project.site?.industry].filter(Boolean),
      generateSitemap: true,
      generateRobots: true
    }
  };
}

function paletteToPrimary(palette = "graphite") {
  return {
    graphite: "#29302e",
    forest: "#176b5b",
    cobalt: "#2f5f93",
    rose: "#9f4e65"
  }[palette] || "#29302e";
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "website-project";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function throwValidation(errors) {
  const error = new Error(errors.join(" "));
  error.statusCode = 400;
  error.publicMessage = errors.join(" ");
  throw error;
}
