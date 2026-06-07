export function renderPage({ page, navPages, config, template, cssPath, scriptPath, body }) {
  const title = seoTitle(page, config);
  const description = page?.seo?.description || config.seo?.description || config.business?.tagline || "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(config.business.name)}">
    <link rel="stylesheet" href="${cssPath}">
  </head>
  <body data-template="${escapeHtml(config.template.selected)}">
    ${renderHeader(page, config, navPages)}
    <main>${body}</main>
    ${renderFooter(config)}
    <script src="${scriptPath}" defer></script>
  </body>
</html>`;
}

export function renderHeader(currentPage, config, navPages = config.pages) {
  const logo = config.branding?.logoUrl ? `<img src="${escapeAttribute(config.branding.logoUrl)}" alt="">` : "";
  const nav = navPages.map((page) => {
    const href = navHref(page, currentPage);
    const current = pageSlug(page) === pageSlug(currentPage) ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${escapeHtml(pageTitle(page))}</a>`;
  }).join("");
  return `<header class="site-header">
  <a class="brand" href="${navHref("Home", currentPage)}">${logo}<span>${escapeHtml(config.business.name)}</span></a>
  <nav class="nav" aria-label="Primary navigation">${nav}</nav>
</header>`;
}

export function renderFooter(config) {
  return `<footer class="footer">
  <div class="footer-inner">
    <strong>${escapeHtml(config.business.name)}</strong>
    <span>${escapeHtml(config.business.location || config.business.industry || "")}</span>
    <span>${escapeHtml(config.business.email || "")}</span>
  </div>
</footer>`;
}

export function pageOutputPath(page) {
  const slug = pageSlug(page);
  return slug === "home" ? "index.html" : `${slug}/index.html`;
}

export function pageSlug(page) {
  if (typeof page === "object" && page?.slug) {
    const slug = page.slug.replace(/^\//, "").replace(/\/$/, "");
    return slug ? slug.toLowerCase().replace(/[^a-z0-9/-]+/g, "-").replace(/\//g, "-") : "home";
  }
  const slug = String(page || "home").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return !slug || slug === "index" ? "home" : slug;
}

export function pageTitle(page) {
  if (typeof page === "object" && page?.title) return String(page.title);
  return String(page || "Home").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#039;");
}

function seoTitle(page, config) {
  if (page?.seo?.title) return page.seo.title;
  if (pageSlug(page) === "home") return config.seo?.title || config.business.name;
  return `${pageTitle(page)} | ${config.business.name}`;
}

function navHref(page, currentPage) {
  const slug = pageSlug(page);
  const currentSlug = pageSlug(currentPage);
  if (slug === "home") return currentSlug === "home" ? "./" : "../";
  return currentSlug === "home" ? `./${slug}/` : `../${slug}/`;
}
