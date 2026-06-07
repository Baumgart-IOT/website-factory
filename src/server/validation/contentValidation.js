export const supportedSectionTypes = new Set([
  "hero",
  "services",
  "about",
  "process",
  "projects",
  "gallery",
  "testimonials",
  "faq",
  "contact",
  "quote_request",
  "cta"
]);

const forbiddenKeys = new Set(["password", "token", "apikey", "secret", "privatekey", "accesstoken", "refreshtoken"]);
const textFieldMax = 1200;

export function validateContent(content) {
  const errors = [];
  if (!isPlainObject(content)) errors.push("Content must be an object.");
  if (!isPlainObject(content?.pages)) errors.push("Content pages must be an object.");
  if (errors.length) throwValidation(errors);

  const slugs = new Set();
  for (const [pageKey, page] of Object.entries(content.pages)) {
    validatePageKey(pageKey, errors);
    validatePage(page, errors, pageKey);
    if (slugs.has(page.slug)) errors.push(`Duplicate page slug: ${page.slug}.`);
    slugs.add(page.slug);
  }

  if (!content.pages.home) errors.push("Content must include a home page.");
  if (Object.keys(content.pages).length < 1) errors.push("Content must contain at least one page.");
  detectForbiddenKeys(content, [], errors);
  validateTextSafety(content, [], errors);
  if (errors.length) throwValidation(errors);
  return content;
}

export function validateContentPatch(patch) {
  const errors = [];
  if (!isPlainObject(patch)) errors.push("Content patch must be an object.");
  if (patch.pages !== undefined && !isPlainObject(patch.pages)) errors.push("Content pages must be an object.");
  detectForbiddenKeys(patch, [], errors);
  validateTextSafety(patch, [], errors);
  if (errors.length) throwValidation(errors);
  return patch;
}

export function validateNewPage(input) {
  const page = normalizePageInput(input);
  const errors = [];
  validatePageKey(page.key, errors);
  validatePage(page.value, errors, page.key);
  if (errors.length) throwValidation(errors);
  return page;
}

export function validatePagePatch(input) {
  const errors = [];
  if (!isPlainObject(input)) errors.push("Page patch must be an object.");
  const allowed = new Set(["title", "slug", "seo", "sections"]);
  for (const key of Object.keys(input || {})) {
    if (!allowed.has(key)) errors.push(`Unsupported page field: ${key}.`);
  }
  if (input.title !== undefined) validateString(input.title, "title", 1, 120, errors);
  if (input.slug !== undefined) validateSlug(input.slug, errors);
  if (input.seo !== undefined) validateSeo(input.seo, errors);
  if (input.sections !== undefined) validateSections(input.sections, errors, "patched page");
  detectForbiddenKeys(input, [], errors);
  validateTextSafety(input, [], errors);
  if (errors.length) throwValidation(errors);
  return input;
}

export function validateNewSection(input) {
  const section = {
    id: clean(input?.id) || sectionId(input?.type),
    type: clean(input?.type),
    enabled: input?.enabled === undefined ? true : input.enabled,
    order: input?.order === undefined ? 1 : Number(input.order),
    content: isPlainObject(input?.content) ? input.content : {}
  };
  const errors = [];
  validateSection(section, errors, "new section");
  if (errors.length) throwValidation(errors);
  return section;
}

export function validateSectionPatch(input) {
  const errors = [];
  if (!isPlainObject(input)) errors.push("Section patch must be an object.");
  const allowed = new Set(["id", "type", "enabled", "order", "content"]);
  for (const key of Object.keys(input || {})) {
    if (!allowed.has(key)) errors.push(`Unsupported section field: ${key}.`);
  }
  if (input.id !== undefined && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(input.id)) errors.push("Section id must be a safe identifier.");
  if (input.type !== undefined && !supportedSectionTypes.has(input.type)) errors.push("Section type is not supported.");
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") errors.push("Section enabled must be true or false.");
  if (input.order !== undefined && !Number.isFinite(Number(input.order))) errors.push("Section order must be numeric.");
  if (input.content !== undefined && !isPlainObject(input.content)) errors.push("Section content must be an object.");
  detectForbiddenKeys(input, [], errors);
  validateTextSafety(input, [], errors);
  if (errors.length) throwValidation(errors);
  return input;
}

export function safePageKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "page";
}

export function slugFromTitle(value) {
  const key = safePageKey(value);
  return key === "home" ? "/" : `/${key}`;
}

function normalizePageInput(input) {
  const title = clean(input?.title || input?.key || "New Page");
  const key = safePageKey(input?.key || title);
  return {
    key,
    value: {
      title,
      slug: input?.slug || slugFromTitle(key),
      seo: {
        title: clean(input?.seo?.title || title),
        description: clean(input?.seo?.description || "")
      },
      sections: Array.isArray(input?.sections) ? input.sections : []
    }
  };
}

function validatePageKey(pageKey, errors) {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(pageKey)) errors.push(`Invalid page key: ${pageKey}.`);
}

function validatePage(page, errors, pageKey) {
  if (!isPlainObject(page)) {
    errors.push(`Page ${pageKey} must be an object.`);
    return;
  }
  validateString(page.title, `${pageKey}.title`, 1, 120, errors);
  validateSlug(page.slug, errors);
  validateSeo(page.seo || {}, errors);
  validateSections(page.sections, errors, pageKey);
}

function validateSlug(slug, errors) {
  if (typeof slug !== "string" || !slug.startsWith("/") || slug.includes("..") || /[<>"']/.test(slug)) {
    errors.push("Page slug must start with / and use a safe path.");
  }
}

function validateSeo(seo, errors) {
  if (!isPlainObject(seo)) {
    errors.push("Page SEO must be an object.");
    return;
  }
  if (seo.title !== undefined) validateString(seo.title, "seo.title", 0, 120, errors);
  if (seo.description !== undefined) validateString(seo.description, "seo.description", 0, 240, errors);
}

function validateSections(sections, errors, pageKey) {
  if (!Array.isArray(sections)) {
    errors.push(`Page ${pageKey} sections must be an array.`);
    return;
  }
  const ids = new Set();
  for (const section of sections) {
    validateSection(section, errors, pageKey);
    if (ids.has(section.id)) errors.push(`Duplicate section id on ${pageKey}: ${section.id}.`);
    ids.add(section.id);
  }
}

function validateSection(section, errors, pageKey) {
  if (!isPlainObject(section)) {
    errors.push(`Section on ${pageKey} must be an object.`);
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(section.id || "")) errors.push(`Section id on ${pageKey} must be a safe identifier.`);
  if (!supportedSectionTypes.has(section.type)) errors.push(`Section type on ${pageKey} is not supported: ${section.type}.`);
  if (typeof section.enabled !== "boolean") errors.push(`Section ${section.id} enabled must be true or false.`);
  if (!Number.isFinite(Number(section.order))) errors.push(`Section ${section.id} order must be numeric.`);
  if (!isPlainObject(section.content)) errors.push(`Section ${section.id} content must be an object.`);
  validateUrls(section.content || {}, errors);
}

function validateUrls(value, errors) {
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (/url$/i.test(key) && nested) {
      const url = String(nested);
      if (!isReasonableUrl(url)) errors.push(`${key} must be an internal path or http/https URL.`);
    }
    validateUrls(nested, errors);
  }
}

function isReasonableUrl(value) {
  return value.startsWith("/") || value.startsWith("#") || /^https?:\/\/[^\s<>"']+$/i.test(value);
}

function validateTextSafety(value, path, errors) {
  if (typeof value === "string") {
    if (value.length > textFieldMax) errors.push(`${path.join(".") || "text"} is too long.`);
    if (/<\s*script|javascript:|on[a-z]+\s*=|<\/?[a-z][\s\S]*>/i.test(value)) errors.push(`${path.join(".") || "text"} contains unsafe HTML or script-like content.`);
    return;
  }
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) validateTextSafety(nested, [...path, key], errors);
}

function detectForbiddenKeys(value, path, errors) {
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (forbiddenKeys.has(normalized)) errors.push(`Content cannot store secret-like field: ${[...path, key].join(".")}.`);
    detectForbiddenKeys(nested, [...path, key], errors);
  }
}

function validateString(value, label, min, max, errors) {
  if (typeof value !== "string") {
    errors.push(`${label} must be a string.`);
    return;
  }
  const length = clean(value).length;
  if (length < min || length > max) errors.push(`${label} must be ${min}-${max} characters.`);
}

function sectionId(type = "section") {
  return `${safePageKey(type)}-${Date.now().toString(36)}`;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
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
