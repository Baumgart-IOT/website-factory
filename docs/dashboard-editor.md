# Dashboard Editor

MJC5 keeps the dashboard frontend dependency-light and static. The rich section editor lives in `src/public/app.js` and is organized around reusable helper functions instead of one-off section code.

## Editor Structure

- `getSectionEditorSchema(sectionType)` defines form fields and repeated-item arrays.
- `renderSectionEditorFields(section)` renders the active section editor.
- `renderTextInput`, `renderTextarea`, `renderCheckbox`, and `renderSelect` create field controls.
- `renderArrayEditor` and `renderArrayItem` create repeated item editors.
- `collectSectionEditorValues(sectionType, formElement)` turns form controls back into section content.
- `validateSectionEditorValues` performs lightweight client-side checks before the backend validates.

## Add A New Section Editor

1. Add the section type to the backend content validation list.
2. Add a renderer for the section in `src/server/rendering/sectionRenderer.js`.
3. Add default content in `defaultSectionContent` inside `src/public/app.js`.
4. Add a schema entry in `getSectionEditorSchema`.
5. Add smoke test coverage if the generated output changes.

## Add A Repeated Item Field

Repeated items are defined in a schema `arrays` entry:

```js
{
  name: "items",
  label: "Service Items",
  itemLabel: "Service",
  fields: [
    { name: "title", label: "Title", kind: "text" },
    { name: "description", label: "Description", kind: "textarea" }
  ]
}
```

The array editor automatically supports add, remove, move up, and move down.

## Image Fields & The Asset Picker (MJC6)

Image-bearing fields (`hero.imageUrl`, `projects.items[].imageUrl`, `gallery.images[].imageUrl`) use the `image` field kind:

```js
image("imageUrl", "Image URL")
```

`renderField` / `renderArrayField` render these via `renderImageField`, which pairs the existing text input with a **"Choose from media"** button. Clicking it is intercepted in `handleSectionFieldClick` and opens the asset picker (`openAssetPicker`); the chosen asset's URL is written back into the input and `input`/`change` events are dispatched so dirty-tracking and `collectSectionEditorValues` keep working unchanged — image fields remain plain string URLs in the content model.

The asset picker itself (`#assetPickerDialog`) is a native `<dialog>` filtered to image-kind assets. See `docs/media-library.md` for the full media library, validation, and branding integration details.

## Save, Build, Preview Flow

- `Save Section` persists the current form content.
- `Save and Build Preview` saves and then calls the build endpoint.
- `Build Preview From Content` builds the last saved content.
- `Open Latest Preview` opens the newest preview path when available.
- Unsaved changes trigger a visible badge and a browser confirm when switching pages or sections.
- The advanced JSON fallback is collapsed by default and still validates before save.
