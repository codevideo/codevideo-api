import * as AWS from 'aws-sdk';

// Configure AWS
const spacesEndpoint = new AWS.Endpoint('nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
});

// Function to upload video to DigitalOcean Spaces
export const uploadFileToSpaces = async (bucketName: string, videoBuffer: Buffer, filename: string) => {
  try {
    // Upload the video file to the specified bucket
    const uploadParams = {
      Bucket: bucketName,
      Key: filename,
      Body: videoBuffer,
      ContentType: 'video/mp4', // Set the content type accordingly
    };

    const result = await s3.upload(uploadParams).promise();
    console.log('Video uploaded successfully:', result.Location);
    return result.Location;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}