import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// TODO: create a new repo called codevideo-cloud and move this function there
// Function to upload video to S3 - can also be used for uploading audio manifest
export const uploadFileToS3 = async (
  videoBuffer: Buffer,
  filename: string
): Promise<string> => {
  const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.CODEVIDEO_S3_KEY_ID || "",
      secretAccessKey: process.env.CODEVIDEO_S3_SECRET || "",
    },
  });

  const params = {
    Bucket: "fullstackcraft",
    Key: `codevideo/${filename}`,
    Body: videoBuffer,
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    console.log(
      "Successfully uploaded object: " + params.Bucket + "/" + params.Key
    );
    // return URL to the uploaded video
    return `https://fullstackcraft.s3.us-east-1.amazonaws.com/${params.Key}`;
  } catch (err) {
    throw new Error(`Error uploading object: ${err}`);
  }
};
