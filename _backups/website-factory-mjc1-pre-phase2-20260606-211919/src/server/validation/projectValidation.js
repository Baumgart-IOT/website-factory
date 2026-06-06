const allowedPalettes = new Set(["graphite", "forest", "cobalt", "rose"]);

export function validateProjectInput(input) {
  const errors = [];
  const value = {
    name: clean(input.name),
    slug: slugify(input.slug || input.name),
    industry: clean(input.industry),
    goal: clean(input.goal),
    audience: clean(input.audience),
    palette: clean(input.palette || "graphite"),
    templateId: clean(input.templateId),
    pages: Array.isArray(input.pages) ? input.pages.map(clean).filter(Boolean) : []
  };

  if (value.name.length < 2 || value.name.length > 80) errors.push("Site name must be 2-80 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) errors.push("Slug must use lowercase letters, numbers, and hyphens.");
  if (value.industry.length < 2 || value.industry.length > 80) errors.push("Industry must be 2-80 characters.");
  if (value.goal.length < 8 || value.goal.length > 240) errors.push("Goal must be 8-240 characters.");
  if (value.audience.length < 3 || value.audience.length > 120) errors.push("Audience must be 3-120 characters.");
  if (!allowedPalettes.has(value.palette)) errors.push("Palette is not supported.");
  if (!value.templateId) errors.push("Template is required.");
  if (value.pages.length < 1 || value.pages.length > 8) errors.push("Choose 1-8 pages.");
  if (value.pages.some((page) => page.length > 40)) errors.push("Page names must be 40 characters or fewer.");

  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.statusCode = 400;
    error.publicMessage = errors.join(" ");
    throw error;
  }

  return value;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
