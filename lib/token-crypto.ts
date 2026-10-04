import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const encodedKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("Missing GOOGLE_TOKEN_ENCRYPTION_KEY");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptGoogleToken(token: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptGoogleToken(value: string, context: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Stored Google token has an unsupported format");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]).toString("utf8");
}
