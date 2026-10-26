import crypto from "crypto";

// Key format:  cvk_<base64url(userId)>.<base64url(secret)>
// Kept free of Clerk so the format can be unit tested on its own.

export const KEY_PREFIX = "cvk_";

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/**
 * Build a new key for userId. Only the secret is random; pass one in to get a
 * deterministic result.
 */
export const createKeyMaterial = (
  userId: string,
  secret: string = crypto.randomBytes(24).toString("base64url")
) => ({
  plaintext: `${KEY_PREFIX}${Buffer.from(userId, "utf8").toString("base64url")}.${secret}`,
  // Studio lists keys as `${prefix}…`. The start of the plaintext is the user
  // id, the same for every key a user has, so the hint comes from the secret:
  // its first 6 chars (36 of 192 bits), shown only to the key's owner.
  prefix: `${KEY_PREFIX}…${secret.slice(0, 6)}`,
  hash: sha256(secret),
});
