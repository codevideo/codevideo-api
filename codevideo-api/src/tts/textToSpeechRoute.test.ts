import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createTextToSpeechHandler,
  textToSpeechJsonErrorHandler,
} from "./textToSpeechRoute.js";
import { createTextToSpeechRateLimiter } from "./textToSpeechRateLimit.js";
import { TextToSpeechError } from "./validateTextToSpeechRequest.js";
let server: http.Server;
let base: string;
let calls = 0;
let fail = false;
beforeEach(async () => {
  calls = 0;
  fail = false;
  const app = express();
  app.use(express.json());
  app.use(textToSpeechJsonErrorHandler);
  app.post(
    "/texttospeech",
    (req, res, next) => {
      if (req.headers.authorization !== "Bearer test") {
        res.status(401).end();
        return;
      }
      (req as any).codevideoUserId = "test-user";
      next();
    },
    createTextToSpeechHandler({
      limiter: createTextToSpeechRateLimiter(),
      synthesize: async () => {
        calls++;
        if (fail)
          throw new TextToSpeechError(400, "ElevenLabs rejected your key");
        return Buffer.from("mp3");
      },
      store: async () => ({ assetId: "asset", mp3Url: "https://audio" }),
    }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
const request = (body: unknown, auth = true) =>
  fetch(base + "/texttospeech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer test" } : {}),
    },
    body: JSON.stringify(body),
  });
it("returns only public take metadata", async () => {
  const response = await request({
    text: "Hi",
    provider: "elevenlabs",
    voiceId: "abcdefghij",
    elevenLabsApiKey: "secret",
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    assetId: "asset",
    mp3Url: "https://audio",
    provider: "elevenlabs",
    voiceId: "abcdefghij",
    speed: 1,
  });
});
it("rejects unauthenticated and invalid requests before synthesis", async () => {
  expect((await request({ text: "Hi" }, false)).status).toBe(401);
  expect((await request({ text: "" })).status).toBe(400);
  expect(calls).toBe(0);
});
it("sends Retry-After on the thirty-first request", async () => {
  for (let i = 0; i < 30; i++)
    expect((await request({ text: "Hi" })).status).toBe(200);
  const response = await request({ text: "Hi" });
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(calls).toBe(30);
});
it("returns a safe rejected-key response", async () => {
  fail = true;
  const response = await request({ text: "Hi" });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "ElevenLabs rejected your key",
  });
});

it("does not echo malformed JSON containing a BYO key", async () => {
  const response = await fetch(base + "/texttospeech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test",
    },
    body: '{"elevenLabsApiKey":"secret", broken',
  });
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("secret");
  expect(calls).toBe(0);
});
