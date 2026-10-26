import crypto from "crypto";
import { clerkClient } from "@clerk/express";
import { KEY_PREFIX, createKeyMaterial, sha256 } from "./apiKeyFormat.js";

// API keys are stored (hashed) in the user's Clerk PRIVATE metadata — never
// publicMetadata, which the client can read. The userId is embedded in the key
// itself so validation needs no database/lookup: parse the userId, load that
// user, and compare the hashed secret against their stored keys.
//
// Key format:  cvk_<base64url(userId)>.<base64url(secret)> (see apiKeyFormat.ts)
// Stored:      { id, name, prefix, hash: sha256(secret), createdAt, lastUsedAt }

export interface ApiKeyRecord {
  id: string;
  name: string;
  // Display only: "cvk_…" + the first chars of the secret. Keys created before
  // that change hold the first 14 chars of the plaintext, which is the same
  // for all of a user's keys.
  prefix: string;
  hash: string; // sha256(secret), hex
  createdAt: string;
  lastUsedAt: string | null;
}

/** What we return to the client — never the hash. */
export type ApiKeySummary = Omit<ApiKeyRecord, "hash">;

const readKeys = (user: { privateMetadata?: unknown }): ApiKeyRecord[] => {
  const meta = user.privateMetadata as { apiKeys?: ApiKeyRecord[] } | undefined;
  return Array.isArray(meta?.apiKeys) ? meta!.apiKeys : [];
};

const writeKeys = async (userId: string, privateMetadata: unknown, apiKeys: ApiKeyRecord[]) => {
  await clerkClient.users.updateUser(userId, {
    privateMetadata: { ...(privateMetadata as object), apiKeys },
  });
};

/** Generate a key, persist its hash, and return the plaintext ONCE. */
export async function generateApiKey(
  userId: string,
  name: string
): Promise<{ plaintext: string; record: ApiKeySummary }> {
  const { plaintext, prefix, hash: secretHash } = createKeyMaterial(userId);
  const record: ApiKeyRecord = {
    id: crypto.randomUUID(),
    name: name.trim() || "API key",
    prefix,
    hash: secretHash,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const user = await clerkClient.users.getUser(userId);
  await writeKeys(userId, user.privateMetadata, [...readKeys(user), record]);
  const { hash, ...summary } = record;
  return { plaintext, record: summary };
}

/** List a user's keys without the secret/hash. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const user = await clerkClient.users.getUser(userId);
  return readKeys(user).map(({ hash, ...summary }) => summary);
}

/** Revoke one key by id. */
export async function revokeApiKey(userId: string, id: string): Promise<void> {
  const user = await clerkClient.users.getUser(userId);
  await writeKeys(userId, user.privateMetadata, readKeys(user).filter((k) => k.id !== id));
}

/**
 * Validate a raw key and return the owning userId, or null. The userId is read
 * from the key, the user is loaded, and the hashed secret is matched against
 * their stored keys. lastUsedAt is bumped at most hourly, best-effort (never
 * blocks the request).
 */
export async function validateApiKey(raw: string): Promise<string | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;
  const body = raw.slice(KEY_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 1) return null;

  let userId: string;
  try {
    userId = Buffer.from(body.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const secret = body.slice(dot + 1);
  if (!userId || !secret) return null;

  let user;
  try {
    user = await clerkClient.users.getUser(userId);
  } catch {
    return null; // unknown / malformed userId
  }

  const keys = readKeys(user);
  const hash = sha256(secret);
  const match = keys.find((k) => k.hash === hash);
  if (!match) return null;

  const now = Date.now();
  const last = match.lastUsedAt ? Date.parse(match.lastUsedAt) : 0;
  if (now - last > 60 * 60 * 1000) {
    match.lastUsedAt = new Date(now).toISOString();
    // fire-and-forget so a key check never waits on a Clerk write
    writeKeys(userId, user.privateMetadata, keys).catch(() => {});
  }
  return userId;
}
