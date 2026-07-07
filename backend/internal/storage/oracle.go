package storage

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"knowledgecanvas/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// oracleStorage talks to Oracle Cloud Object Storage via its S3-compatible API.
type oracleStorage struct {
	client *s3.Client
	bucket string
}

func newOracle(cfg *config.Config) (Storage, error) {
	ctx := context.Background()
	endpoint := cfg.OCIStorageEndpoint

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.OCIRegion),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.OCIAccessKey, cfg.OCISecretKey, "",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true // required for the Oracle compat endpoint
	})

	return &oracleStorage{client: client, bucket: cfg.OCIBucketName}, nil
}

func (s *oracleStorage) Upload(ctx context.Context, key string, body []byte, contentType string) (string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("storage: put %s: %w", key, err)
	}
	return key, nil
}

func (s *oracleStorage) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if key == "" {
		return "", nil
	}
	presign := s3.NewPresignClient(s.client)
	req, err := presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage: presign %s: %w", key, err)
	}
	return req.URL, nil
}

func (s *oracleStorage) Delete(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
