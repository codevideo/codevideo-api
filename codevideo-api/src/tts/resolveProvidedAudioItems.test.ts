import { resolveProvidedAudioItems } from "./resolveProvidedAudioItems.js";
const filename = "12345678-1234-1234-1234-123456789abc.mp3";
const mp3Url = `https://fullstackcraft.s3.us-east-1.amazonaws.com/codevideo/texttospeech/${filename}`;
const context = { dev: false, origin: "https://api.codevideo.io" };
it("accepts absence and approved production takes, dropping unknown fields", () => {
  expect(resolveProvidedAudioItems(undefined, context)).toEqual([]);
  expect(
    resolveProvidedAudioItems(
      [{ text: " hi ", mp3Url, durationMs: 123, secret: "no" }],
      context,
    ),
  ).toEqual([{ text: " hi ", mp3Url, durationMs: 123 }]);
});
it.each([
  "https://evil.example/a.mp3",
  `http://fullstackcraft.s3.us-east-1.amazonaws.com/codevideo/texttospeech/${filename}`,
  `https://fullstackcraft.s3.us-east-1.amazonaws.com.evil.example/codevideo/texttospeech/${filename}`,
  `https://user:pass@fullstackcraft.s3.us-east-1.amazonaws.com/codevideo/texttospeech/${filename}`,
  mp3Url + "?x=1",
  mp3Url + "#x",
  mp3Url.replace("texttospeech/", ""),
  mp3Url.replace(filename, "../other.mp3"),
  `http://localhost:7000/dev-audio/${filename}`,
])("rejects unapproved URLs: %s", (url) => {
  expect(() =>
    resolveProvidedAudioItems([{ text: "Hi", mp3Url: url }], context),
  ).toThrow();
});
it("allows dev URLs only on the current dev origin", () => {
  const url = `http://localhost:7000/dev-audio/${filename}`;
  expect(
    resolveProvidedAudioItems([{ text: "Hi", mp3Url: url }], {
      dev: true,
      origin: "http://localhost:7000",
    }),
  ).toHaveLength(1);
  expect(() =>
    resolveProvidedAudioItems([{ text: "Hi", mp3Url: url }], {
      dev: true,
      origin: "http://other:7000",
    }),
  ).toThrow();
});
it("validates collection size, text, and duration", () => {
  for (const input of [
    null,
    {},
    Array(501).fill({ text: "Hi", mp3Url }),
    [{ text: "", mp3Url }],
    [{ text: "x".repeat(1001), mp3Url }],
    [{ text: "Hi", mp3Url, durationMs: NaN }],
    [{ text: "Hi", mp3Url, durationMs: 0 }],
    [{ text: "Hi", mp3Url, durationMs: "100" }],
  ])
    expect(() => resolveProvidedAudioItems(input, context)).toThrow();
});
it("accepts repeated identical takes sent by the studio, but rejects conflicting takes for one text", () => {
  expect(
    resolveProvidedAudioItems(
      [
        { text: "Hi", mp3Url },
        { text: "Hi", mp3Url },
      ],
      context,
    ),
  ).toHaveLength(2);
  expect(() =>
    resolveProvidedAudioItems(
      [
        { text: "Hi", mp3Url },
        { text: "Hi", mp3Url: mp3Url.replace("12345678-", "aaaaaaaa-") },
      ],
      context,
    ),
  ).toThrow();
});
