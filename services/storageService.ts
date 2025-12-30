
import { PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3Client, MINIO_BUCKET_NAME, getPublicUrl } from "../lib/minio";
import { Attachment } from "../types";

let bucketVerified = false;

/**
 * Ensures the target bucket exists in MinIO.
 */
const ensureBucketExists = async () => {
  if (bucketVerified) return;

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
    bucketVerified = true;
  } catch (error: any) {
    // If bucket doesn't exist, attempt to create it
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.warn(`Bucket "${MINIO_BUCKET_NAME}" not found. Creating...`);
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
        console.log(`Bucket "${MINIO_BUCKET_NAME}" successfully created.`);
        bucketVerified = true;
      } catch (createError: any) {
        console.error("Critical error creating bucket:", createError);
      }
    } else {
      console.error("Error during bucket verification:", error);
    }
  }
};

export const uploadFileToMinio = async (file: File): Promise<Attachment> => {
  const fileExtension = file.name.split('.').pop();
  const uniqueName = `${crypto.randomUUID()}.${fileExtension}`;
  
  try {
    await ensureBucketExists();

    const arrayBuffer = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: uniqueName,
      Body: body,
      ContentType: file.type || 'application/octet-stream',
      // Since the bucket is public, we don't strictly need ACL here if the bucket policy handles it,
      // but keeping it standard.
    });

    await s3Client.send(command);
    
    const publicUrl = getPublicUrl(uniqueName);

    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: publicUrl
    };
  } catch (error: any) {
    console.error("MinIO Upload Error:", error);
    throw new Error(`Failed to upload "${file.name}": ${error.message}`);
  }
};

export const deleteFileFromMinio = async (fileUrl: string): Promise<void> => {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    // In Path Style (endpoint/bucket/key), the last part is the key.
    const key = pathParts[pathParts.length - 1];

    if (!key) {
      console.error("Could not extract key from URL:", fileUrl);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: MINIO_BUCKET_NAME,
      Key: decodeURIComponent(key),
    });

    await s3Client.send(command);
    console.log(`File ${key} successfully removed from MinIO.`);
  } catch (error) {
    console.error("Error removing file from MinIO:", error);
  }
};
