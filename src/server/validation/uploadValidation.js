import { readBody } from "../utils/http.js";

const MAX_LOGO_BYTES = Number.parseInt(process.env.MAX_LOGO_BYTES || "1048576", 10);
const MAX_IMAGE_BYTES = Number.parseInt(process.env.MAX_IMAGE_BYTES || String(5 * 1024 * 1024), 10);
const MAX_FAVICON_BYTES = Number.parseInt(process.env.MAX_FAVICON_BYTES || String(1 * 1024 * 1024), 10);

const logoTypes = new Set(["image/png", "image/svg+xml"]);

const extensionByMime = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico"
};

const mimeByExtension = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon"
};

const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp", "svg", "ico"]);
const dangerousExtensions = new Set([
  "exe", "bat", "cmd", "com", "sh", "bash", "ps1", "msi", "scr", "js", "mjs", "cjs",
  "vbs", "jar", "php", "phtml", "asp", "aspx", "jsp", "py", "rb", "pl", "html", "htm",
  "svgz", "dll", "apk", "app", "dmg", "iso", "wsf", "hta"
]);

export async function parseMultipartLogo(req) {
  const file = await parseMultipartFile(req, "logo", MAX_LOGO_BYTES);
  const result = validateUploadedFile(file, { kind: "logo", maxBytes: MAX_LOGO_BYTES, allowedTypes: logoTypes });
  if (!result.valid) throwPublic(result.statusCode || 400, result.errors[0]);

  return {
    filename: sanitizeFilename(file.filename),
    contentType: result.normalizedMimeType,
    buffer: file.body,
    validation: result
  };
}

export async function parseMultipartMedia(req, options = {}) {
  const fieldName = options.fieldName || "file";
  const maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
  const file = await parseMultipartFile(req, fieldName, maxBytes);
  const result = validateUploadedFile(file, {
    kind: options.kind || "image",
    maxBytes,
    allowedTypes: options.allowedTypes
  });
  if (!result.valid) throwPublic(result.statusCode || 400, result.errors[0]);

  return {
    originalName: sanitizeFilename(file.filename),
    mimeType: result.normalizedMimeType,
    normalizedExtension: result.normalizedExtension,
    kind: result.kind,
    buffer: file.body,
    validation: result
  };
}

/**
 * Validates an uploaded file's metadata and content. Returns a consistent
 * result shape: { valid, errors, warnings, normalizedExtension, kind }.
 * This never trusts client-declared MIME type alone.
 */
export function validateUploadedFile(file, options = {}) {
  const errors = [];
  const warnings = [];
  const maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
  const allowedTypes = options.allowedTypes;

  const filename = String(file?.filename || "").trim();
  if (!filename) {
    errors.push("A file name is required.");
    return invalid(errors, warnings, 400);
  }

  const declaredType = String(file?.declaredType || "").toLowerCase().trim();
  const rawExtension = (filename.split(".").pop() || "").toLowerCase();

  if (dangerousExtensions.has(rawExtension)) {
    errors.push(`File extension .${rawExtension} is not allowed for security reasons.`);
    return invalid(errors, warnings, 400);
  }

  if (!allowedExtensions.has(rawExtension)) {
    errors.push(`File extension .${rawExtension || "(none)"} is not supported. Allowed types: png, jpg, jpeg, webp, svg, ico.`);
    return invalid(errors, warnings, 400);
  }

  const normalizedExtension = rawExtension === "jpeg" ? "jpg" : rawExtension;
  const expectedMime = mimeByExtension[rawExtension];
  const normalizedMimeType = declaredType && Object.values(mimeByExtension).includes(declaredType) ? declaredType : expectedMime;

  if (declaredType && expectedMime && declaredType !== expectedMime && !(rawExtension === "jpeg" && declaredType === "image/jpeg")) {
    warnings.push(`Declared content type (${declaredType}) does not match the file extension (.${rawExtension}).`);
  }

  if (allowedTypes && allowedTypes.size && !allowedTypes.has(normalizedMimeType)) {
    errors.push(`File type ${normalizedMimeType} is not supported here.`);
    return invalid(errors, warnings, 400);
  }

  const buffer = file?.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    errors.push("Uploaded file is empty.");
    return invalid(errors, warnings, 400);
  }

  const kind = options.kind || "image";
  const maxForKind = kind === "favicon" ? Math.min(maxBytes, MAX_FAVICON_BYTES) : maxBytes;
  if (buffer.length > maxForKind) {
    errors.push(`File must be ${formatBytes(maxForKind)} or smaller.`);
    return invalid(errors, warnings, 413);
  }

  if (!hasSafeSignature(buffer, normalizedExtension)) {
    errors.push("File content does not match its declared type.");
    return invalid(errors, warnings, 400);
  }

  if (normalizedExtension === "svg") {
    const svgText = buffer.toString("utf8");
    if (hasUnsafeSvg(svgText)) {
      errors.push("SVG files cannot contain scripts, event handlers, or external references.");
      return invalid(errors, warnings, 400);
    }
    warnings.push("SVG content is rendered as-is; keep SVG uploads limited to trusted sources.");
  }

  if (/[^\x20-\x7e]/.test(filename.replace(/[À-ɏ]/g, ""))) {
    warnings.push("File name contains unusual characters and was normalized.");
  }

  return {
    valid: true,
    errors,
    warnings,
    normalizedExtension,
    normalizedMimeType,
    kind
  };
}

async function parseMultipartFile(req, fieldName, maxBytes) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    throwPublic(400, "Upload must use multipart/form-data.");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const body = Buffer.from(await readBody(req, maxBytes + 1024 * 64), "binary");
  const parts = splitMultipart(body, boundary);
  const filePart = parts.find((part) => part.headers["content-disposition"]?.includes(`name="${fieldName}"`));

  if (!filePart || !filePart.filename) {
    throwPublic(400, `Upload a file using the field name ${fieldName}.`);
  }

  return {
    filename: filePart.filename,
    declaredType: (filePart.headers["content-type"] || "").toLowerCase(),
    body: filePart.body
  };
}

function splitMultipart(body, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = body.indexOf(marker);

  while (cursor !== -1) {
    const next = body.indexOf(marker, cursor + marker.length);
    if (next === -1) break;

    const segment = body.subarray(cursor + marker.length + 2, next - 2);
    const divider = segment.indexOf(Buffer.from("\r\n\r\n"));
    if (divider !== -1) {
      const rawHeaders = segment.subarray(0, divider).toString("utf8");
      const headers = Object.fromEntries(
        rawHeaders.split("\r\n").map((line) => {
          const [key, ...rest] = line.split(":");
          return [key.toLowerCase(), rest.join(":").trim()];
        })
      );
      const disposition = headers["content-disposition"] || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1];
      parts.push({ headers, filename, body: segment.subarray(divider + 4) });
    }
    cursor = next;
  }

  return parts;
}

function hasSafeSignature(buffer, extension) {
  if (extension === "png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === "jpg" || extension === "jpeg") {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (extension === "webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (extension === "ico") {
    return buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]));
  }
  if (extension === "svg" || extension === "svgz") {
    return buffer.toString("utf8", 0, 512).toLowerCase().includes("<svg");
  }
  return false;
}

function hasUnsafeSvg(svg) {
  const normalized = svg.toLowerCase();
  return /<script|on[a-z]+\s*=|href\s*=\s*["']https?:|xlink:href\s*=|<foreignobject|<iframe/.test(normalized);
}

function sanitizeFilename(filename) {
  const base = String(filename || "asset").split(/[\\/]/).pop();
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "asset";
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function invalid(errors, warnings, statusCode) {
  return { valid: false, errors, warnings, normalizedExtension: null, normalizedMimeType: null, kind: null, statusCode };
}

function throwPublic(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}
