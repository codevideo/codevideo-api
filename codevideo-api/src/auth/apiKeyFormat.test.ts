import { KEY_PREFIX, createKeyMaterial, sha256 } from "./apiKeyFormat.js";

const userId = "user_2uAbCdEfGhIjKlMnOpQrStUvWx";
const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");

describe("createKeyMaterial", () => {
  it("builds cvk_<base64url(userId)>.<secret> keys", () => {
    const { plaintext } = createKeyMaterial(userId, "s3cr3tPart_example-value");
    expect(plaintext).toBe(`${KEY_PREFIX}${encodedUserId}.s3cr3tPart_example-value`);
  });

  it("hashes only the secret", () => {
    expect(createKeyMaterial(userId, "abc").hash).toBe(sha256("abc"));
    expect(sha256("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives the display prefix from the secret, not the user id", () => {
    const { prefix } = createKeyMaterial(userId, "AbCdEfGhIjKl");
    expect(prefix).toBe("cvk_…AbCdEf");
    expect(prefix).not.toContain(encodedUserId.slice(0, 6));
  });

  it("gives a user's keys different prefixes", () => {
    const prefixes = new Set(Array.from({ length: 20 }, () => createKeyMaterial(userId).prefix));
    expect(prefixes.size).toBe(20);
  });

  it("generates a fresh 24-byte secret per key", () => {
    const first = createKeyMaterial(userId);
    const second = createKeyMaterial(userId);
    const secretOf = (plaintext: string) => plaintext.slice(plaintext.indexOf(".") + 1);
    expect(secretOf(first.plaintext)).toHaveLength(32);
    expect(secretOf(first.plaintext)).not.toBe(secretOf(second.plaintext));
    expect(first.prefix).toBe(`cvk_…${secretOf(first.plaintext).slice(0, 6)}`);
  });
});
