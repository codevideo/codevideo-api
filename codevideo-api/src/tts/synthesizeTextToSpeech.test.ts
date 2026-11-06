import { jest } from "@jest/globals";
const kokoro = jest.fn<(...args: any[]) => Promise<ArrayBuffer>>();
const eleven = jest.fn<(...args: any[]) => Promise<ArrayBuffer>>();
jest.unstable_mockModule("./getAudioArrayBufferKokoro.js", () => ({
  getAudioArrayBufferKokoro: kokoro,
}));
jest.unstable_mockModule(
  "../elevenlabs/getAudioArrayBufferElevenLabs.js",
  () => ({ getAudioArrayBufferElevenLabs: eleven }),
);
const { synthesizeTextToSpeech } = await import("./synthesizeTextToSpeech.js");
const previous = process.env.TTS_SERVICE_URL;
afterEach(() => {
  if (previous === undefined) delete process.env.TTS_SERVICE_URL;
  else process.env.TTS_SERVICE_URL = previous;
  kokoro.mockReset();
  eleven.mockReset();
});
it("passes speed and voice to Kokoro", async () => {
  process.env.TTS_SERVICE_URL = "http://tts";
  kokoro.mockResolvedValue(new ArrayBuffer(4));
  expect(
    (
      await synthesizeTextToSpeech({
        text: "Hi",
        provider: "kokoro",
        voiceId: "af_heart",
        speed: 0.7,
      })
    ).length,
  ).toBe(4);
  expect(kokoro).toHaveBeenCalledWith("Hi", "http://tts", "af_heart", 0.7);
  expect(eleven).not.toHaveBeenCalled();
});
it("reports missing Kokoro configuration", async () => {
  delete process.env.TTS_SERVICE_URL;
  await expect(
    synthesizeTextToSpeech({
      text: "Hi",
      provider: "kokoro",
      voiceId: "af_heart",
      speed: 1,
    }),
  ).rejects.toMatchObject({ status: 503 });
});
it.each([401, 403])("maps ElevenLabs %i to a safe 400", async (status) => {
  eleven.mockRejectedValue(Object.assign(new Error("private-key"), { status }));
  await expect(
    synthesizeTextToSpeech({
      text: "Hi",
      provider: "elevenlabs",
      voiceId: "abcdefghij",
      elevenLabsApiKey: "private-key",
      speed: 1,
    }),
  ).rejects.toMatchObject({
    status: 400,
    message: "ElevenLabs rejected your key",
  });
  expect(eleven).toHaveBeenCalledWith("Hi", "private-key", "abcdefghij");
});
it("does not echo provider errors", async () => {
  eleven.mockRejectedValue(new Error("private-key"));
  await expect(
    synthesizeTextToSpeech({
      text: "Hi",
      provider: "elevenlabs",
      voiceId: "abcdefghij",
      elevenLabsApiKey: "private-key",
      speed: 1,
    }),
  ).rejects.toMatchObject({
    status: 502,
    message: "Speech generation failed. Please try again.",
  });
});
