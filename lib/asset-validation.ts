import { ACCEPTED_ASSET_MIME_TYPES, MAX_ASSET_BYTES } from "@/lib/assets";

export function validateAssetBytes(bytes: Buffer, mimeType: string, declaredSize = bytes.byteLength) {
  if (declaredSize > MAX_ASSET_BYTES) return "Файл превышает лимит 4 МБ.";
  if (!ACCEPTED_ASSET_MIME_TYPES.has(mimeType)) return "Поддерживаются PNG, JPG, JPEG, WEBP и SVG.";
  if (!matchesMimeSignature(bytes, mimeType)) return "Содержимое файла не соответствует заявленному формату.";
  if (mimeType === "image/svg+xml" && containsUnsafeSvg(bytes.toString("utf8"))) return "SVG содержит потенциально небезопасный код.";
  return null;
}

function matchesMimeSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mimeType === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mimeType === "image/svg+xml") return /<svg[\s>]/i.test(bytes.toString("utf8").slice(0, 2048));
  return false;
}
function containsUnsafeSvg(value: string) {
  return /<script|on\w+\s*=|javascript:|<foreignObject/i.test(value);
}
