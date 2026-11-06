import {
  createTextToSpeechRateLimiter,
  TEXT_TO_SPEECH_TOKEN_COST,
} from "./textToSpeechRateLimit.js";
it("allows 30 requests per rolling minute, shared per user and independent across users", () => {
  let time = 0;
  const limiter = createTextToSpeechRateLimiter(() => time);
  for (let i = 0; i < 30; i++) expect(limiter.consume("a").allowed).toBe(true);
  expect(limiter.consume("a")).toEqual({
    allowed: false,
    retryAfterSeconds: 60,
  });
  expect(limiter.consume("b").allowed).toBe(true);
  time = 59999;
  expect(limiter.consume("a").allowed).toBe(false);
  time = 60000;
  expect(limiter.consume("a").allowed).toBe(true);
});
it("limits to 300 per UTC day, resetting at midnight", () => {
  let time = 0;
  const limiter = createTextToSpeechRateLimiter(() => time);
  for (let minute = 0; minute < 10; minute++) {
    time = minute * 60000;
    for (let i = 0; i < 30; i++)
      expect(limiter.consume("a").allowed).toBe(true);
  }
  time = 600000;
  expect(limiter.consume("a").allowed).toBe(false);
  time = 86400000;
  expect(limiter.consume("a").allowed).toBe(true);
  expect(TEXT_TO_SPEECH_TOKEN_COST).toBe(0);
});
