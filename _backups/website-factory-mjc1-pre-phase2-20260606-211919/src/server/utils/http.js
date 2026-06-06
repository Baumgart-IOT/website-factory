export async function readBody(req, maxBytes) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      error.publicMessage = "Request body is too large.";
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("binary");
}
