import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import type { VideoUploadResponse } from '@highlight-reel/shared';
import { VIDEO_LIMITS } from '@highlight-reel/shared';

export type UploadState = 'idle' | 'picking' | 'uploading' | 'confirming' | 'done' | 'error';

export function useVideoUpload(onComplete?: () => void) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
  }, []);

  const pickAndUpload = useCallback(async () => {
    try {
      setState('picking');
      setError(null);

      // Request permission
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to upload videos.'
        );
        setState('idle');
        return;
      }

      // Pick video
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
        videoMaxDuration: VIDEO_LIMITS.MAX_DURATION_MINUTES * 60,
      });

      if (result.canceled || !result.assets[0]) {
        setState('idle');
        return;
      }

      const asset = result.assets[0];

      // Validate file size
      if (asset.fileSize && asset.fileSize > VIDEO_LIMITS.MAX_FILE_SIZE_BYTES) {
        Alert.alert(
          'File Too Large',
          `Maximum file size is ${VIDEO_LIMITS.MAX_FILE_SIZE_MB}MB. Your video is ${Math.round(asset.fileSize / (1024 * 1024))}MB.`
        );
        setState('idle');
        return;
      }

      setState('uploading');
      setProgress(10);

      // 1. Get pre-signed upload URL
      const fileName = asset.uri.split('/').pop() || 'video.mp4';
      const { video_id, upload_url } = await api.post<VideoUploadResponse>(
        '/api/videos/upload-url',
        {
          file_name: fileName,
          file_size: asset.fileSize || 0,
          mime_type: asset.mimeType || 'video/mp4',
        }
      );
      setProgress(20);

      // 2. Upload the file directly to storage
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      setProgress(40);

      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': asset.mimeType || 'video/mp4',
        },
      });
      setProgress(80);

      // 3. Confirm upload — this triggers the processing pipeline
      setState('confirming');
      await api.patch(`/api/videos/${video_id}/status`, {
        status: 'uploaded',
      });
      setProgress(100);

      setState('done');

      Alert.alert(
        'Upload Complete!',
        'Your video is being analyzed by AI. We\'ll detect the best highlights automatically.',
        [{ text: 'OK' }]
      );

      onComplete?.();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setState('error');
      Alert.alert('Upload Failed', err.message || 'Something went wrong');
    }
  }, [onComplete]);

  return {
    state,
    progress,
    error,
    isUploading: state === 'uploading' || state === 'confirming' || state === 'picking',
    pickAndUpload,
    reset,
  };
}
