import { validateTextToSpeechRequest as validate } from "./validateTextToSpeechRequest.js";
it("defaults to Kokoro, af_heart, and speed 1", () => {
  expect(validate({ text: "Hello" }, undefined)).toEqual({
    text: "Hello",
    provider: "kokoro",
    voiceId: "af_heart",
    speed: 1,
  });
});
it("uses the configured default voice and preserves text exactly", () => {
  expect(validate({ text: " Hello " }, "am_michael")).toMatchObject({
    text: " Hello ",
    voiceId: "am_michael",
  });
});
it.each([
  null,
  [],
  {},
  { text: "" },
  { text: "  " },
  { text: 42 },
  { text: "x".repeat(1001) },
  { text: "hi", provider: "other" },
  { text: "hi", voiceId: "../../x" },
  { text: "hi", speed: 0.49 },
  { text: "hi", speed: 2.01 },
  { text: "hi", speed: NaN },
  { text: "hi", speed: "1" },
])("rejects invalid input %#", (body) => {
  expect(() => validate(body)).toThrow();
});
it("accepts boundary text lengths and Kokoro speeds", () => {
  for (const text of ["a", "a".repeat(1000)])
    for (const speed of [0.5, 2])
      expect(validate({ text, speed }).speed).toBe(speed);
});
it("requires a BYO key and valid ElevenLabs voice id, never default server credentials", () => {
  const body = {
    text: "Hi",
    provider: "elevenlabs",
    voiceId: "abcdefghij",
    elevenLabsApiKey: "my-key",
  };
  expect(validate(body)).toEqual({ ...body, speed: 1 });
  for (const fields of [
    { elevenLabsApiKey: "" },
    { voiceId: "short" },
    { voiceId: "../invalid" },
    { voiceId: "a".repeat(41) },
    { elevenLabsApiKey: "key\nleak" },
    { speed: 1.2 },
  ])
    expect(() => validate({ ...body, ...fields })).toThrow();
  expect(() => validate({ text: "hi", provider: "elevenlabs" })).toThrow();
});
it("drops a BYO key from Kokoro requests", () => {
  expect(
    validate({ text: "hi", elevenLabsApiKey: "secret" }),
  ).not.toHaveProperty("elevenLabsApiKey");
});

it("treats an empty configured voice as unset and rejects explicit null fields", () => {
  expect(validate({ text: "Hi" }, "").voiceId).toBe("af_heart");
  for (const fields of [{ provider: null }, { voiceId: null }, { speed: null }])
    expect(() => validate({ text: "Hi", ...fields })).toThrow();
});
