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

// UploadFileToSpaces uploads a file buffer to DigitalOcean Spaces and returns the URL.
// It expects the environment variables CODEVIDEO_SPACES_KEY_ID and CODEVIDEO_SPACES_SECRET
// to be set for authentication.
func UploadFileToSpaces(ctx context.Context, buffer []byte, filename string) (string, error) {
	accessKeyID := os.Getenv("CODEVIDEO_SPACES_KEY_ID")
	secretAccessKey := os.Getenv("CODEVIDEO_SPACES_SECRET")
	if accessKeyID == "" || secretAccessKey == "" {
		return "", fmt.Errorf("DigitalOcean Spaces credentials are not set")
	}

	// Custom endpoint resolver for DigitalOcean Spaces.
	customResolver := aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
		if service == s3.ServiceID && region == "sfo2" {
			return aws.Endpoint{
				URL:           "https://sfo2.digitaloceanspaces.com",
				SigningRegion: "sfo2",
			}, nil
		}
		return aws.Endpoint{}, fmt.Errorf("unknown endpoint requested")
	})

	// Load AWS configuration with the custom resolver.
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("sfo2"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		config.WithEndpointResolver(customResolver),
	)
	if err != nil {
		return "", fmt.Errorf("failed to load configuration: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	// Define the bucket and key for the upload.
	bucket := "coffee-app"
	key := fmt.Sprintf("codevideo/v3/%s", filename)

	// Perform the PutObject request.
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(buffer),
		ACL:    "public-read", // Set the ACL to public-read
	})
	if err != nil {
		return "", fmt.Errorf("error uploading object: %w", err)
	}

	// Return the public URL for the uploaded file.
	url := fmt.Sprintf("https://%s.sfo2.cdn.digitaloceanspaces.com/%s", bucket, key)
	return url, nil
}
