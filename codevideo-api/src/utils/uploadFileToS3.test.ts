import { jest } from "@jest/globals";
const send = jest.fn<(...args: any[]) => Promise<any>>();
jest.unstable_mockModule("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: any) {}
  },
}));
const { uploadFileToS3 } = await import("./uploadFileToS3.js");
afterEach(() => send.mockReset());
it("sets audio MIME/cache headers only when supplied", async () => {
  send.mockResolvedValue({});
  const url = await uploadFileToS3(
    Buffer.from("mp3"),
    "texttospeech/asset.mp3",
    {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
    },
  );
  expect(send.mock.calls[0][0].input).toMatchObject({
    Bucket: "fullstackcraft",
    Key: "codevideo/texttospeech/asset.mp3",
    ContentType: "audio/mpeg",
    CacheControl: "public, max-age=31536000, immutable",
  });
  expect(url).toBe(
    "https://fullstackcraft.s3.us-east-1.amazonaws.com/codevideo/texttospeech/asset.mp3",
  );
  await uploadFileToS3(Buffer.from("old"), "old.mp3");
  expect(send.mock.calls[1][0].input).not.toHaveProperty("CacheControl");
  expect(send.mock.calls[1][0].input).not.toHaveProperty("ContentType");
});
