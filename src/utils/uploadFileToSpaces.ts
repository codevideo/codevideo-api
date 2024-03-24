import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// secret: 1OWtrUzie+D3zIoEfWVob0Xt1N63HDjvzViZV/j0l4I
// access: DO00WQP2ZC96E8XL76JG

// Function to upload video to DigitalOcean Spaces
export const uploadFileToSpaces = async (
  videoBuffer: Buffer,
  filename: string
): Promise<string> => {
  const s3Client = new S3Client({
    endpoint: "https://sfo2.digitaloceanspaces.com",
    forcePathStyle: false,
    region: "sfo2",
    credentials: {
      accessKeyId: "DO00WQP2ZC96E8XL76JG",
      secretAccessKey: process.env.SPACES_SECRET || "",
    },
  });

  const params = {
    Bucket: "coffee-app",
    Key: `codevideo/${filename}`,
    Body: videoBuffer,
    ACL: ObjectCannedACL.public_read,
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    console.log(
      "Successfully uploaded object: " + params.Bucket + "/" + params.Key
    );
    // return URL to the uploaded video
    return `https://${params.Bucket}.sfo2.cdn.digitaloceanspaces.com/${params.Key}`;
  } catch (err) {
    throw new Error(`Error uploading object: ${err}`);
  }
};
