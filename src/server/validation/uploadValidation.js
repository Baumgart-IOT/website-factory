import { readBody } from "../utils/http.js";

const MAX_LOGO_BYTES = Number.parseInt(process.env.MAX_LOGO_BYTES || "1048576", 10);
const allowedTypes = new Set(["image/png", "image/svg+xml"]);

export async function parseMultipartLogo(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!boundaryMatch) {
    throwPublic(400, "Logo upload must use multipart/form-data.");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const body = Buffer.from(await readBody(req, MAX_LOGO_BYTES + 1024 * 32), "binary");
  const parts = splitMultipart(body, boundary);
  const filePart = parts.find((part) => part.headers["content-disposition"]?.includes('name="logo"'));

  if (!filePart || !filePart.filename) {
    throwPublic(400, "Upload a logo file using the field name logo.");
  }

  const declaredType = (filePart.headers["content-type"] || "").toLowerCase();
  if (!allowedTypes.has(declaredType)) {
    throwPublic(400, "Logo must be a PNG or SVG file.");
  }

  if (filePart.body.length > MAX_LOGO_BYTES) {
    throwPublic(413, "Logo must be 1 MB or smaller.");
  }

  if (!hasSafeSignature(filePart.body, declaredType)) {
    throwPublic(400, "Logo file content does not match the declared type.");
  }

  if (declaredType === "image/svg+xml" && hasUnsafeSvg(filePart.body.toString("utf8"))) {
    throwPublic(400, "SVG logo cannot contain scripts, event handlers, or external references.");
  }

  return {
    filename: sanitizeFilename(filePart.filename),
    contentType: declaredType,
    buffer: filePart.body
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

function hasSafeSignature(buffer, contentType) {
  if (contentType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return buffer.toString("utf8", 0, 256).toLowerCase().includes("<svg");
}

function hasUnsafeSvg(svg) {
  const normalized = svg.toLowerCase();
  return /<script|on[a-z]+\s*=|href\s*=\s*["']https?:|xlink:href\s*=/.test(normalized);
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function throwPublic(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}
