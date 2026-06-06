import { escapeHtml, pageSlug, pageTitle } from "./pageRenderer.js";

export function renderSections(page, config, template) {
  const sectionOrder = sectionsForPage(page, config, template);
  return sectionOrder.map((section) => renderSection(section, page, config, template)).join("\n");
}

export function renderSection(section, page, config, template) {
  const renderer = sectionRenderers[section] || renderCta;
  return renderer(page, config, template);
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

function renderHero(page, config, template) {
  const home = pageSlug(page) === "home";
  const title = home ? config.business.name : pageTitle(page);
  const lead = home ? config.business.tagline : `${pageTitle(page)} for ${config.business.industry || "your next stage of growth"}.`;
  return `<section class="section hero" id="${pageSlug(page)}">
  <div class="section-inner hero-grid">
    <div>
      <p class="eyebrow">${escapeHtml(template?.previewPersonality || template?.previewTone || config.template.selected)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
      <div class="button-row">
        <a class="button" href="${linkFor(page, "Contact")}">Start a conversation</a>
        <a class="button secondary" href="${linkFor(page, "Services")}">View services</a>
      </div>
    </div>
    <div class="visual-panel">
      <p>${escapeHtml(config.business.industry || "Professional website")}</p>
    </div>
  </div>
</section>`;
}

function renderServices(_page, config) {
  const industry = config.business.industry || "your market";
  return `<section class="section" id="services">
  <div class="section-inner">
    <p class="eyebrow">Services</p>
    <h2>Clear offers for ${escapeHtml(industry)}</h2>
    <div class="grid">
      ${card("Strategy", `Position your ${industry} offer with a clear message and conversion path.`)}
      ${card("Delivery", "Turn business goals into practical website sections, pages, and calls to action.")}
      ${card("Growth", "Use the site as a foundation for search, trust, referrals, and lead capture.")}
    </div>
  </div>
</section>`;
}

function renderAbout(_page, config) {
  return `<section class="section" id="about">
  <div class="section-inner">
    <p class="eyebrow">About</p>
    <h2>Built around ${escapeHtml(config.business.name)}</h2>
    <p class="lead">${escapeHtml(config.business.name)} helps ${escapeHtml(config.business.industry || "customers")} move from interest to action with a focused, credible web presence.</p>
  </div>
</section>`;
}

function renderProcess() {
  return `<section class="section" id="process">
  <div class="section-inner">
    <p class="eyebrow">Process</p>
    <h2>A practical path from first visit to next step</h2>
    <ol class="list">
      <li>Clarify the visitor's problem and desired outcome.</li>
      <li>Show the services, proof, and answers they need to trust the offer.</li>
      <li>Guide them to a simple contact or quote request action.</li>
    </ol>
  </div>
</section>`;
}

function renderProjects(_page, config) {
  return `<section class="section" id="projects">
  <div class="section-inner">
    <p class="eyebrow">Projects</p>
    <h2>Proof placeholders ready for real work</h2>
    <div class="grid">
      ${card("Outcome story", `A future case study showing measurable results for ${config.business.industry || "customers"}.`)}
      ${card("Before and after", "A structured proof block for transformation, performance, or launch work.")}
      ${card("Client win", "A concise project summary with challenge, solution, and result.")}
    </div>
  </div>
</section>`;
}

function renderGallery() {
  return `<section class="section" id="gallery">
  <div class="section-inner">
    <p class="eyebrow">Gallery</p>
    <h2>Visual gallery placeholders</h2>
    <div class="gallery-grid">
      <div class="gallery-item"></div><div class="gallery-item"></div><div class="gallery-item"></div><div class="gallery-item"></div>
    </div>
  </div>
</section>`;
}

function renderTestimonials(_page, config) {
  if (!config.features?.testimonials) return "";
  return `<section class="section" id="testimonials">
  <div class="section-inner">
    <p class="eyebrow">Testimonials</p>
    <h2>Trust signals for future customers</h2>
    <div class="grid two">
      ${card("Client perspective", `${config.business.name} made the next step clear and easy to trust.`)}
      ${card("Decision confidence", "The site explains the offer, proof, and process without friction.")}
    </div>
  </div>
</section>`;
}

function renderFaq(_page, config) {
  if (!config.features?.faq) return "";
  return `<section class="section" id="faq">
  <div class="section-inner">
    <p class="eyebrow">FAQ</p>
    <h2>Questions visitors need answered</h2>
    <div class="grid">
      ${card("Who is this for?", `Organizations looking for ${config.business.industry || "professional"} support.`)}
      ${card("How do we start?", "Use the contact section to share goals, timing, and fit.")}
      ${card("What happens next?", "The next step is a focused conversation and a clear plan.")}
    </div>
  </div>
</section>`;
}

function renderContact(_page, config) {
  if (!config.features?.contactForm) return "";
  return `<section class="section" id="contact">
  <div class="section-inner">
    <p class="eyebrow">Contact</p>
    <h2>Talk with ${escapeHtml(config.business.name)}</h2>
    <p class="lead">${escapeHtml(config.business.email || "Add an email address in the project editor.")}</p>
    <p>${escapeHtml(config.business.phone || config.business.location || "Add phone or location details when ready.")}</p>
  </div>
</section>`;
}

function renderQuoteRequest(_page, config) {
  if (!config.features?.quoteRequest) return "";
  return `<section class="section" id="quote-request">
  <div class="section-inner quote-box">
    <p class="eyebrow">Quote request</p>
    <h2>Request a focused estimate</h2>
    <input placeholder="Name" disabled>
    <input placeholder="Email" disabled>
    <textarea rows="4" placeholder="Project details" disabled></textarea>
    <p>This mock form is disabled until production form handling is added.</p>
  </div>
</section>`;
}

function renderCta(page, config) {
  return `<section class="section" id="cta">
  <div class="section-inner card">
    <p class="eyebrow">Next step</p>
    <h2>Ready to shape the next version of ${escapeHtml(config.business.name)}?</h2>
    <p>${escapeHtml(config.business.tagline || "Start with a clear conversation and a focused plan.")}</p>
    <div class="button-row"><a class="button" href="${linkFor(page, "Contact")}">Contact us</a></div>
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
