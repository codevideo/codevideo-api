import { jest } from "@jest/globals";
const fetchMock = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("isomorphic-fetch", () => ({ default: fetchMock }));
const { getAudioArrayBufferElevenLabs } =
  await import("./getAudioArrayBufferElevenLabs.js");
afterEach(() => fetchMock.mockReset());
it("uses the supplied key and voice", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  });
  await getAudioArrayBufferElevenLabs("Hi", "byo-key", "voice123456");
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://api.elevenlabs.io/v1/text-to-speech/voice123456",
  );
  expect(fetchMock.mock.calls[0][1].headers["xi-api-key"]).toBe("byo-key");
});
it.each([401, 403])(
  "retains HTTP status %i without upstream text or key",
  async (status) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      text: async () => "byo-key",
    });
    await expect(
      getAudioArrayBufferElevenLabs("Hi", "byo-key", "voice123456"),
    ).rejects.toMatchObject({
      status,
      message: `ElevenLabs returned HTTP ${status}`,
    });
  },
);
