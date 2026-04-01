/**
 * Storage Service
 *
 * Manages file operations with Supabase Storage:
 * - Pre-signed upload/download URLs
 * - File management across buckets
 * - Thumbnail generation paths
 */

import { supabaseAdmin } from '../middleware/auth';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';

export class StorageService {
  /**
   * Generate a pre-signed upload URL for direct client-side upload.
   * This bypasses the API server — the client uploads directly to storage.
   */
  async createUploadUrl(
    bucket: string,
    path: string
  ): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw new Error(`Failed to create upload URL: ${error.message}`);
    }

    return { signedUrl: data.signedUrl, token: data.token };
  }

  /**
   * Generate a pre-signed download URL for secure file access.
   * URLs expire after the specified duration.
   */
  async createDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new Error(`Failed to create download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Download a file from storage as a buffer.
   * Used by the video processing worker to fetch raw videos.
   */
  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload a file buffer to storage.
   * Used by workers to store processed videos, thumbnails, and reels.
   */
  async uploadFile(
    bucket: string,
    path: string,
    fileBuffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return path;
  }

  /**
   * Upload a file from a local filesystem path.
   * Used by FFmpeg workers after processing.
   */
  async uploadFromPath(
    bucket: string,
    storagePath: string,
    localFilePath: string,
    contentType: string
  ): Promise<string> {
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(localFilePath);
    return this.uploadFile(bucket, storagePath, fileBuffer, contentType);
  }

  /**
   * Delete a file from storage.
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from storage.
   */
  async deleteFiles(bucket: string, paths: string[]): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove(paths);

    if (error) {
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Generate storage paths for video processing outputs.
   */
  generatePaths(userId: string, videoId: string) {
    return {
      rawVideo: `${userId}/${videoId}`,
      processedVideo: `${userId}/${videoId}/processed.mp4`,
      thumbnail: `${userId}/${videoId}/thumbnail.jpg`,
      frames: `${userId}/${videoId}/frames`,
      audio: `${userId}/${videoId}/audio.wav`,
      reel: (reelId: string) => `${userId}/reels/${reelId}.mp4`,
      reelThumbnail: (reelId: string) =>
        `${userId}/reels/${reelId}_thumb.jpg`,
    };
  }
}

export const storageService = new StorageService();
