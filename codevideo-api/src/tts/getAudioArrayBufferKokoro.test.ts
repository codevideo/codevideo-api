import { jest } from "@jest/globals";
const fetchMock = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("isomorphic-fetch", () => ({ default: fetchMock }));
const { getAudioArrayBufferKokoro } =
  await import("./getAudioArrayBufferKokoro.js");
afterEach(() => {
  fetchMock.mockReset();
  delete process.env.TTS_API_KEY;
});
it("forwards voice, speed and the internal service bearer", async () => {
  process.env.TTS_API_KEY = "internal";
  const bytes = new ArrayBuffer(2);
  fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
  expect(
    await getAudioArrayBufferKokoro(
      "Hello",
      "http://tts:3000/",
      "af_heart",
      0.8,
    ),
  ).toBe(bytes);
  expect(fetchMock.mock.calls[0][0]).toBe("http://tts:3000/v1/audio/speech");
  const options = fetchMock.mock.calls[0][1];
  expect(JSON.parse(options.body)).toEqual({
    input: "Hello",
    voice: "af_heart",
    speed: 0.8,
    response_format: "mp3",
  });
  expect(options.headers.Authorization).toBe("Bearer internal");
});
it("does not expose an upstream error body", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => "private request text",
  });
  await expect(
    getAudioArrayBufferKokoro("Hello", "http://tts"),
  ).rejects.toThrow("HTTP 500");
});
