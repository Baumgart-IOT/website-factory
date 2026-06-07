import { escapeHtml, pageSlug, pageTitle } from "./pageRenderer.js";

export function renderSections(page, config, template) {
  if (Array.isArray(page?.sections)) {
    return page.sections
      .filter((section) => section.enabled)
      .sort((a, b) => a.order - b.order)
      .map((section) => renderSection(section, page, config, template))
      .join("\n");
  }
  const sectionOrder = sectionsForPage(page, config, template);
  return sectionOrder.map((section) => renderSection(section, page, config, template)).join("\n");
}

export function renderSection(section, page, config, template) {
  const type = typeof section === "string" ? section : section.type;
  const renderer = sectionRenderers[type] || renderCta;
  return renderer(page, config, template, typeof section === "string" ? null : section);
}

function sectionsForPage(page, config, template) {
  const key = pageSlug(page);
  if (key === "home") return template?.sectionOrder || ["hero", "services", "process", "testimonials", "faq", "cta", "contact"];
  if (key.includes("service")) return ["hero", "services", "process", "quote_request", "cta"];
  if (key.includes("about")) return ["hero", "about", "process", "testimonials", "cta"];
  if (key.includes("project") || key.includes("work")) return ["hero", "projects", "gallery", "cta"];
  if (key.includes("gallery")) return ["hero", "gallery", "cta"];
  if (key.includes("faq")) return ["hero", "faq", "contact"];
  if (key.includes("contact")) return ["hero", "contact", "quote_request"];
  return ["hero", "about", "services", "cta"];
}

const sectionRenderers = {
  hero: renderHero,
  services: renderServices,
  about: renderAbout,
  process: renderProcess,
  projects: renderProjects,
  gallery: renderGallery,
  testimonials: renderTestimonials,
  faq: renderFaq,
  contact: renderContact,
  quote_request: renderQuoteRequest,
  cta: renderCta,
  footer: () => ""
};

function renderHero(page, config, template, section) {
  const content = section?.content || {};
  const home = pageSlug(page) === "home";
  const title = first(content.heading, home ? config.business.name : pageTitle(page));
  const lead = first(content.subheading, content.body, home ? config.business.tagline : `${pageTitle(page)} for ${config.business.industry || "your next stage of growth"}.`);
  const eyebrow = first(content.eyebrow, template?.previewPersonality, template?.previewTone, config.template.selected);
  const primaryText = first(content.primaryButtonText, "Start a conversation");
  const primaryUrl = first(content.primaryButtonUrl, linkFor(page, "Contact"));
  const secondaryText = first(content.secondaryButtonText, "View services");
  const secondaryUrl = first(content.secondaryButtonUrl, linkFor(page, "Services"));
  const image = content.imageUrl ? `<img src="${escapeHtml(content.imageUrl)}" alt="" loading="lazy">` : "";
  return `<section class="section hero" id="${pageSlug(page)}">
  <div class="section-inner hero-grid">
    <div>
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
      <div class="button-row">
        <a class="button" href="${escapeHtml(primaryUrl)}">${escapeHtml(primaryText)}</a>
        <a class="button secondary" href="${escapeHtml(secondaryUrl)}">${escapeHtml(secondaryText)}</a>
      </div>
    </div>
    <div class="visual-panel">
      ${image}
      <p>${escapeHtml(config.business.industry || "Professional website")}</p>
    </div>
  </div>
</section>`;
}

function renderServices(_page, config, _template, section) {
  const content = section?.content || {};
  const industry = config.business.industry || "your market";
  const items = Array.isArray(content.items) && content.items.length ? content.items : [
    { title: "Strategy", description: `Position your ${industry} offer with a clear message and conversion path.` },
    { title: "Delivery", description: "Turn business goals into practical website sections, pages, and calls to action." },
    { title: "Growth", description: "Use the site as a foundation for search, trust, referrals, and lead capture." }
  ];
  return `<section class="section" id="services">
  <div class="section-inner">
    <p class="eyebrow">Services</p>
    <h2>${escapeHtml(first(content.heading, `Clear offers for ${industry}`))}</h2>
    <p class="lead">${escapeHtml(first(content.subheading, "Focused services shaped around visitor intent and business goals."))}</p>
    <div class="grid">
      ${items.map((item) => card(item.title || item.icon || "Service", item.description || "Describe this service in the content editor.")).join("")}
    </div>
  </div>
</section>`;
}

function renderAbout(_page, config, _template, section) {
  const content = section?.content || {};
  const highlights = Array.isArray(content.highlights) ? content.highlights : [];
  return `<section class="section" id="about">
  <div class="section-inner">
    <p class="eyebrow">About</p>
    <h2>${escapeHtml(first(content.heading, `Built around ${config.business.name}`))}</h2>
    <p class="lead">${escapeHtml(first(content.body, `${config.business.name} helps ${config.business.industry || "customers"} move from interest to action with a focused, credible web presence.`))}</p>
    ${highlights.length ? `<ul class="list">${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
  </div>
</section>`;
}

function renderProcess(_page, _config, _template, section) {
  const content = section?.content || {};
  const steps = Array.isArray(content.steps) && content.steps.length ? content.steps : [
    { title: "Clarify", description: "Clarify the visitor's problem and desired outcome." },
    { title: "Guide", description: "Show the services, proof, and answers they need to trust the offer." },
    { title: "Convert", description: "Guide them to a simple contact or quote request action." }
  ];
  return `<section class="section" id="process">
  <div class="section-inner">
    <p class="eyebrow">Process</p>
    <h2>${escapeHtml(first(content.heading, "A practical path from first visit to next step"))}</h2>
    <ol class="list">
      ${steps.map((step) => `<li><strong>${escapeHtml(step.title || "Step")}</strong> ${escapeHtml(step.description || "")}</li>`).join("")}
    </ol>
  </div>
</section>`;
}

function renderProjects(_page, config, _template, section) {
  const content = section?.content || {};
  const items = Array.isArray(content.items) && content.items.length ? content.items : [
    { title: "Outcome story", description: `A future case study showing measurable results for ${config.business.industry || "customers"}.` },
    { title: "Before and after", description: "A structured proof block for transformation, performance, or launch work." },
    { title: "Client win", description: "A concise project summary with challenge, solution, and result." }
  ];
  return `<section class="section" id="projects">
  <div class="section-inner">
    <p class="eyebrow">Projects</p>
    <h2>${escapeHtml(first(content.heading, "Proof placeholders ready for real work"))}</h2>
    <div class="grid">
      ${items.map((item) => card(item.title || "Project", item.description || "Add project detail in the content editor.")).join("")}
    </div>
  </div>
</section>`;
}

function renderGallery(_page, _config, _template, section) {
  const content = section?.content || {};
  const images = Array.isArray(content.images) && content.images.length ? content.images : [{}, {}, {}, {}];
  return `<section class="section" id="gallery">
  <div class="section-inner">
    <p class="eyebrow">Gallery</p>
    <h2>${escapeHtml(first(content.heading, "Visual gallery placeholders"))}</h2>
    <div class="gallery-grid">
      ${images.map((image) => image.imageUrl ? `<img class="gallery-item" src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.alt || "")}" loading="lazy">` : `<div class="gallery-item"></div>`).join("")}
    </div>
  </div>
</section>`;
}

function renderTestimonials(_page, config, _template, section) {
  if (!config.features?.testimonials) return "";
  const content = section?.content || {};
  const items = Array.isArray(content.items) && content.items.length ? content.items : [
    { quote: `${config.business.name} made the next step clear and easy to trust.`, name: "Client perspective", role: "" },
    { quote: "The site explains the offer, proof, and process without friction.", name: "Decision confidence", role: "" }
  ];
  return `<section class="section" id="testimonials">
  <div class="section-inner">
    <p class="eyebrow">Testimonials</p>
    <h2>${escapeHtml(first(content.heading, "Trust signals for future customers"))}</h2>
    <div class="grid two">
      ${items.map((item) => card(item.name || "Testimonial", `${item.quote || "Add a client quote."} ${item.role ? `- ${item.role}` : ""}`)).join("")}
    </div>
  </div>
</section>`;
}

function renderFaq(_page, config, _template, section) {
  if (!config.features?.faq) return "";
  const content = section?.content || {};
  const items = Array.isArray(content.items) && content.items.length ? content.items : [
    { question: "Who is this for?", answer: `Organizations looking for ${config.business.industry || "professional"} support.` },
    { question: "How do we start?", answer: "Use the contact section to share goals, timing, and fit." },
    { question: "What happens next?", answer: "The next step is a focused conversation and a clear plan." }
  ];
  return `<section class="section" id="faq">
  <div class="section-inner">
    <p class="eyebrow">FAQ</p>
    <h2>${escapeHtml(first(content.heading, "Questions visitors need answered"))}</h2>
    <div class="grid">
      ${items.map((item) => card(item.question || "Question", item.answer || "Add an answer in the content editor.")).join("")}
    </div>
  </div>
</section>`;
}

function renderContact(_page, config, _template, section) {
  if (!config.features?.contactForm) return "";
  const content = section?.content || {};
  return `<section class="section" id="contact">
  <div class="section-inner">
    <p class="eyebrow">Contact</p>
    <h2>${escapeHtml(first(content.heading, `Talk with ${config.business.name}`))}</h2>
    <p class="lead">${escapeHtml(first(content.body, content.email, config.business.email, "Add an email address in the project editor."))}</p>
    <p>${escapeHtml(first(content.phone, config.business.phone, content.address, config.business.location, "Add phone or location details when ready."))}</p>
  </div>
</section>`;
}

function renderQuoteRequest(_page, config, _template, section) {
  if (!config.features?.quoteRequest) return "";
  const content = section?.content || {};
  const fields = Array.isArray(content.fields) && content.fields.length ? content.fields : ["Name", "Email", "Project details"];
  return `<section class="section" id="quote-request">
  <div class="section-inner quote-box">
    <p class="eyebrow">Quote request</p>
    <h2>${escapeHtml(first(content.heading, "Request a focused estimate"))}</h2>
    <p>${escapeHtml(first(content.body, "This mock form is disabled until production form handling is added."))}</p>
    ${fields.map((field) => `<input placeholder="${escapeHtml(field.label || field)}" disabled>`).join("")}
  </div>
</section>`;
}

function renderCta(page, config, _template, section) {
  const content = section?.content || {};
  return `<section class="section" id="cta">
  <div class="section-inner card">
    <p class="eyebrow">Next step</p>
    <h2>${escapeHtml(first(content.heading, `Ready to shape the next version of ${config.business.name}?`))}</h2>
    <p>${escapeHtml(first(content.body, config.business.tagline, "Start with a clear conversation and a focused plan."))}</p>
    <div class="button-row"><a class="button" href="${escapeHtml(first(content.buttonUrl, linkFor(page, "Contact")))}">${escapeHtml(first(content.buttonText, "Contact us"))}</a></div>
  </div>
</section>`;
}

function card(title, body) {
  return `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`;
}

function linkFor(currentPage, targetPage) {
  const slug = pageSlug(targetPage);
  const currentSlug = pageSlug(currentPage);
  if (slug === "home") return currentSlug === "home" ? "./" : "../";
  return currentSlug === "home" ? `./${slug}/` : `../${slug}/`;
}

function first(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}
