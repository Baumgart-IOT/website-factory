export function renderTheme(config, template) {
  const branding = config.branding || {};
  const defaults = template?.themeDefaults || {};
  const darkMode = Boolean(branding.darkMode);
  const primary = branding.primaryColor || defaults.primaryColor || "#176b5b";
  const accent = branding.accentColor || defaults.accentColor || "#d88c4a";
  const background = branding.backgroundColor || defaults.backgroundColor || (darkMode ? "#101816" : "#fffdfa");
  const text = darkMode ? "#f6f0e7" : "#1f2523";

  return `:root {
  --primary-color: ${primary};
  --accent-color: ${accent};
  --background-color: ${background};
  --surface-color: ${darkMode ? "#17211e" : "#ffffff"};
  --text-color: ${text};
  --muted-color: ${darkMode ? "#b9c7c1" : "#68716d"};
  --line-color: ${darkMode ? "#30413b" : "#d9d3c8"};
  --radius: ${radius(branding.borderRadius)};
  --font-heading: ${font(branding.headingFont || defaults.headingFont || "Inter")};
  --font-body: ${font(branding.bodyFont || defaults.bodyFont || "Inter")};
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--background-color);
  color: var(--text-color);
  font-family: var(--font-body), Arial, sans-serif;
}
a { color: inherit; }
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px clamp(18px, 5vw, 72px);
  background: color-mix(in srgb, var(--background-color) 92%, transparent);
  border-bottom: 1px solid var(--line-color);
  backdrop-filter: blur(14px);
}
.brand { display: flex; align-items: center; gap: 12px; font-weight: 900; text-decoration: none; }
.brand img { width: 38px; height: 38px; object-fit: contain; border-radius: calc(var(--radius) / 2); }
.nav { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px 18px; }
.nav a { color: var(--muted-color); font-weight: 800; text-decoration: none; }
.nav a[aria-current="page"] { color: var(--primary-color); }
main { display: grid; gap: clamp(48px, 8vw, 92px); }
.section { padding: 0 clamp(18px, 5vw, 72px); }
.section-inner { max-width: 1120px; margin: 0 auto; }
.hero {
  padding-top: clamp(56px, 9vw, 112px);
  min-height: 62vh;
  display: grid;
  align-items: center;
}
.hero-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 42px; align-items: center; }
.eyebrow { margin: 0 0 12px; color: var(--accent-color); font-size: 13px; font-weight: 900; text-transform: uppercase; }
h1, h2, h3 { font-family: var(--font-heading), Arial, sans-serif; letter-spacing: 0; }
h1 { margin: 0; color: var(--primary-color); font-size: clamp(44px, 8vw, 86px); line-height: .98; }
h2 { margin: 0 0 14px; font-size: clamp(30px, 4vw, 48px); line-height: 1.05; }
h3 { margin: 0 0 8px; font-size: 20px; }
p { color: var(--muted-color); line-height: 1.7; }
.lead { font-size: clamp(18px, 2vw, 22px); max-width: 720px; }
.button-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border-radius: var(--radius);
  padding: 0 18px;
  background: var(--primary-color);
  color: #fff;
  font-weight: 900;
  text-decoration: none;
}
.button.secondary { background: transparent; color: var(--primary-color); border: 1px solid var(--line-color); }
.visual-panel, .card {
  border: 1px solid var(--line-color);
  border-radius: var(--radius);
  background: var(--surface-color);
  box-shadow: 0 18px 48px rgba(20, 25, 23, .08);
}
.visual-panel { min-height: 330px; padding: 28px; display: grid; align-content: end; overflow: hidden; }
.visual-panel::before {
  content: "";
  display: block;
  height: 180px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  opacity: .9;
}
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card { padding: 22px; }
.card-image { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: calc(var(--radius) / 1.5); margin-bottom: 14px; }
.list { display: grid; gap: 12px; margin: 20px 0 0; padding: 0; list-style: none; }
.list li { border-left: 4px solid var(--accent-color); padding: 8px 0 8px 14px; color: var(--muted-color); }
.gallery-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.gallery-item { aspect-ratio: 4 / 3; border-radius: var(--radius); background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); opacity: .86; }
.footer { margin-top: 64px; padding: 36px clamp(18px, 5vw, 72px); border-top: 1px solid var(--line-color); }
.footer-inner { max-width: 1120px; margin: 0 auto; display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.quote-box { display: grid; gap: 10px; max-width: 680px; }
.quote-box input, .quote-box textarea {
  width: 100%;
  border: 1px solid var(--line-color);
  border-radius: var(--radius);
  padding: 12px;
  background: var(--surface-color);
  color: var(--text-color);
}
.quote-box select {
  width: 100%;
  border: 1px solid var(--line-color);
  border-radius: var(--radius);
  padding: 12px;
  background: var(--surface-color);
  color: var(--text-color);
}
.quote-checkbox { display: flex; align-items: center; gap: 8px; color: var(--muted-color); }
@media (max-width: 900px) {
  .hero-grid, .grid, .grid.two, .gallery-grid { grid-template-columns: 1fr; }
  .site-header { display: grid; }
  .nav { justify-content: flex-start; }
}`;
}

function radius(value) {
  return {
    none: "0px",
    small: "4px",
    medium: "8px",
    large: "16px"
  }[value] || "8px";
}

function font(value) {
  return JSON.stringify(String(value || "Inter"));
}
