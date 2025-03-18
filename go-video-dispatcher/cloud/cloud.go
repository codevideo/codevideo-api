package cloud

import (
	"bytes"
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// UploadFileToS3 uploads a file buffer to S3 and returns the URL.
// It expects the environment variables CODEVIDEO_S3_KEY_ID and CODEVIDEO_S3_SECRET
// to be set for authentication.
func UploadFileToS3(ctx context.Context, buffer []byte, filename string) (string, error) {
	accessKeyID := os.Getenv("CODEVIDEO_S3_KEY_ID")
	secretAccessKey := os.Getenv("CODEVIDEO_S3_SECRET")
	if accessKeyID == "" || secretAccessKey == "" {
		return "", fmt.Errorf("S3 credentials are not set")
	}

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("us-east-1"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
	)
	if err != nil {
		return "", fmt.Errorf("failed to load configuration: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	// Define the bucket and key for the upload.
	bucket := "fullstackcraft"
	key := fmt.Sprintf("codevideo/v3/%s", filename)

	// Perform the PutObject request.
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(buffer),
	})
	if err != nil {
		return "", fmt.Errorf("error uploading object: %w", err)
	}

	// Return the public URL for the uploaded file.
	url := fmt.Sprintf("https://fullstackcraft.s3.us-east-1.amazonaws.com/%s", key)
	return url, nil
}
