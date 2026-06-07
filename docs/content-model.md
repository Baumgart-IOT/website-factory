# Content Model

MJC4 adds structured content so generated websites can render user-authored page and section content instead of relying only on professional placeholders.

## Content Schema

```json
{
  "content": {
    "pages": {
      "home": {
        "title": "Home",
        "slug": "/",
        "seo": {
          "title": "SEO title",
          "description": "SEO description"
        },
        "sections": [
          {
            "id": "hero-main",
            "type": "hero",
            "enabled": true,
            "order": 1,
            "content": {}
          }
        ]
      }
    }
  }
}
```

## Page Structure

- Page keys must be safe identifiers such as `home`, `services`, or `case-studies`.
- Slugs must start with `/`.
- Every project must keep at least one page.
- The home page cannot be deleted in MJC4.
- Page SEO overrides global project SEO during rendering.

## Section Structure

Every section has:

- `id`: unique within its page.
- `type`: one supported section type.
- `enabled`: boolean.
- `order`: numeric render order.
- `content`: section-specific object.

Disabled sections are not rendered. Sections render in ascending `order`.

## Supported Section Types

- `hero`
- `services`
- `about`
- `process`
- `projects`
- `gallery`
- `testimonials`
- `faq`
- `contact`
- `quote_request`
- `cta`

## Field Examples

Hero:

```json
{
  "eyebrow": "MJC4",
  "heading": "Authored hero heading",
  "subheading": "Structured content drives the renderer.",
  "body": "",
  "primaryButtonText": "Talk to us",
  "primaryButtonUrl": "/contact",
  "secondaryButtonText": "See services",
  "secondaryButtonUrl": "/services",
  "imageUrl": ""
}
```

Services:

```json
{
  "heading": "Services",
  "subheading": "Focused offers.",
  "items": [
    {
      "title": "Content Strategy",
      "description": "Plan the sections that matter.",
      "icon": "map"
    }
  ]
}
```

FAQ:

```json
{
  "heading": "FAQ",
  "items": [
    {
      "question": "How do we start?",
      "answer": "Send the project goals and timing."
    }
  ]
}
```

## Rendering Fallback

The renderer prefers `project.content.pages`. If a project has no persisted content, the renderer seeds compatible content from existing project config in memory so old MJC3 projects continue to build.

For each section, user-authored fields win. Missing fields are filled with professional fallback content based on business name, industry, tagline, selected template, and template metadata.

## Add A New Section Type

1. Add the section type to `supportedSectionTypes` in `src/server/validation/contentValidation.js`.
2. Add default editor content in `src/public/app.js`.
3. Add seed logic in `src/server/services/contentService.js`.
4. Add a renderer function and map entry in `src/server/rendering/sectionRenderer.js`.
5. Add smoke coverage when the section affects generated files.
