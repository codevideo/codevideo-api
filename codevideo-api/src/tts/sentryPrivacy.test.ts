import { jest } from "@jest/globals";
let configuration: any;
jest.unstable_mockModule("@sentry/node", () => ({
  init: (config: any) => {
    configuration = config;
  },
}));
await import("../../instrument.mjs");
it("omits request bodies from Sentry including serialized or malformed JSON keys", () => {
  for (const data of [
    { elevenLabsApiKey: "secret", text: "private" },
    '{"elevenLabsApiKey":"secret"}',
    "malformed key secret",
  ]) {
    const event = { request: { data, url: "/texttospeech" } };
    const result = configuration.beforeSend(event);
    expect(result.request.url).toBe("/texttospeech");
    expect(result.request).not.toHaveProperty("data");
    expect(JSON.stringify(result)).not.toContain("secret");
  }
});
