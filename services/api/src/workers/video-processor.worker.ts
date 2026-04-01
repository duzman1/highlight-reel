/**
 * Video Processor Worker
 *
 * This is the core pipeline that transforms a raw uploaded video into
 * AI-analyzed highlights. It runs as a BullMQ worker processing jobs
 * from the 'video-analysis' queue.
 *
 * Pipeline steps:
 * 1. Download raw video from storage
 * 2. Transcode to standardized format (H.264 MP4 720p)
 * 3. Extract thumbnail at 2-second mark
 * 4. Extract keyframes at 1fps for motion analysis
 * 5. Extract audio track as WAV for audio analysis
 * 6. Send frames + audio to Python AI service
 * 7. Store AI-detected highlights in database
 * 8. Upload processed outputs to storage
 * 9. Update video status to 'analyzed'
 */

import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabaseAdmin } from '../middleware/auth';
import { storageService } from '../services/storage.service';
import {
  getRedisConnection,
  QUEUE_NAMES,
  VideoAnalysisJobData,
} from '../services/queue.service';
import { config } from '../config';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';

// ============================================
// FFmpeg HELPERS
// ============================================

/**
 * Run an FFmpeg command and return a promise.
 * Streams stderr for progress logging.
 */
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Get video metadata (duration, resolution) using ffprobe.
 */
function getVideoInfo(
  filePath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let stdout = '';
    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.on('close', (code) => {
      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams?.find(
          (s: any) => s.codec_type === 'video'
        );

        resolve({
          duration: parseFloat(info.format?.duration || '0'),
          width: parseInt(videoStream?.width || '0', 10),
          height: parseInt(videoStream?.height || '0', 10),
        });
      } catch {
        reject(new Error('Failed to parse video info'));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`ffprobe error: ${err.message}`));
    });
  });
}

// ============================================
// PIPELINE STEPS
// ============================================

/**
 * Step 1: Download the raw video from Supabase Storage to a temp file.
 */
async function downloadRawVideo(
  storageBucket: string,
  storagePath: string,
  tempDir: string
): Promise<string> {
  console.log('  📥 Downloading raw video from storage...');

  const videoBuffer = await storageService.downloadFile(
    storageBucket,
    storagePath
  );

  const ext = path.extname(storagePath) || '.mp4';
  const rawPath = path.join(tempDir, `raw${ext}`);
  fs.writeFileSync(rawPath, videoBuffer);

  const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(1);
  console.log(`  📥 Downloaded: ${sizeMB} MB`);

  return rawPath;
}

/**
 * Step 2: Transcode video to H.264 MP4 720p for consistent processing.
 */
async function transcodeVideo(
  inputPath: string,
  tempDir: string
): Promise<string> {
  console.log('  🔄 Transcoding to H.264 MP4 720p...');

  const outputPath = path.join(tempDir, 'processed.mp4');

  await runFFmpeg([
    '-i', inputPath,
    '-vf', 'scale=-2:720',          // Scale to 720p, maintain aspect ratio
    '-c:v', 'libx264',              // H.264 codec
    '-preset', 'fast',               // Balance speed/quality
    '-crf', '23',                    // Good quality
    '-c:a', 'aac',                   // AAC audio
    '-b:a', '128k',                  // 128k audio bitrate
    '-movflags', '+faststart',       // Web-optimized
    '-y',                            // Overwrite output
    outputPath,
  ]);

  console.log('  🔄 Transcode complete');
  return outputPath;
}

/**
 * Step 3: Extract a thumbnail at the 2-second mark.
 */
async function extractThumbnail(
  inputPath: string,
  tempDir: string
): Promise<string> {
  console.log('  🖼️  Extracting thumbnail...');

  const thumbPath = path.join(tempDir, 'thumbnail.jpg');

  await runFFmpeg([
    '-i', inputPath,
    '-ss', '2',                      // Seek to 2 seconds
    '-vframes', '1',                 // Extract 1 frame
    '-vf', 'scale=480:-2',           // 480px wide thumbnail
    '-q:v', '3',                     // JPEG quality
    '-y',
    thumbPath,
  ]);

  console.log('  🖼️  Thumbnail extracted');
  return thumbPath;
}

/**
 * Step 4: Extract keyframes at 1fps for motion analysis.
 */
async function extractFrames(
  inputPath: string,
  tempDir: string
): Promise<string> {
  console.log('  🎞️  Extracting frames at 1fps...');

  const framesDir = path.join(tempDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  await runFFmpeg([
    '-i', inputPath,
    '-vf', 'fps=1,scale=320:-2',     // 1fps, 320px wide for fast analysis
    '-q:v', '5',                     // Lower quality is fine for analysis
    '-y',
    path.join(framesDir, 'frame_%05d.jpg'),
  ]);

  const frameCount = fs.readdirSync(framesDir).length;
  console.log(`  🎞️  Extracted ${frameCount} frames`);
  return framesDir;
}

/**
 * Step 5: Extract audio track as WAV for audio analysis.
 */
async function extractAudio(
  inputPath: string,
  tempDir: string
): Promise<string> {
  console.log('  🔊 Extracting audio track...');

  const audioPath = path.join(tempDir, 'audio.wav');

  await runFFmpeg([
    '-i', inputPath,
    '-vn',                           // No video
    '-acodec', 'pcm_s16le',          // 16-bit PCM WAV
    '-ar', '22050',                  // 22kHz sample rate (enough for analysis)
    '-ac', '1',                      // Mono
    '-y',
    audioPath,
  ]);

  console.log('  🔊 Audio extracted');
  return audioPath;
}

/**
 * Step 6: Send frames + audio to Python AI service for highlight detection.
 */
async function analyzeWithAI(
  videoId: string,
  framesDir: string,
  audioPath: string,
  maxHighlights: number = 15
): Promise<
  {
    start_time_ms: number;
    end_time_ms: number;
    score: number;
    type: string;
    label: string | null;
  }[]
> {
  console.log('  🤖 Sending to AI service for analysis...');

  const response = await fetch(`${config.ai.serviceUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_id: videoId,
      frames_dir: framesDir,
      audio_path: audioPath,
      fps: 1.0,
      max_highlights: maxHighlights,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(
    `  🤖 AI detected ${result.highlights.length} highlights in ${result.processing_time_seconds}s`
  );

  return result.highlights;
}

/**
 * Step 7: Store highlights in the database.
 */
async function saveHighlights(
  videoId: string,
  userId: string,
  highlights: {
    start_time_ms: number;
    end_time_ms: number;
    score: number;
    type: string;
    label: string | null;
  }[]
): Promise<void> {
  console.log(`  💾 Saving ${highlights.length} highlights to database...`);

  if (highlights.length === 0) {
    console.log('  💾 No highlights to save');
    return;
  }

  const rows = highlights.map((h) => ({
    video_id: videoId,
    user_id: userId,
    start_time_ms: h.start_time_ms,
    end_time_ms: h.end_time_ms,
    label: h.label,
    source: 'ai',
    ai_score: h.score,
    ai_type: h.type,
    is_accepted: null, // Pending parent review
  }));

  const { error } = await supabaseAdmin.from('highlights').insert(rows);

  if (error) {
    throw new Error(`Failed to save highlights: ${error.message}`);
  }

  console.log('  💾 Highlights saved');
}

/**
 * Step 8: Upload processed outputs to storage.
 */
async function uploadProcessedOutputs(
  userId: string,
  videoId: string,
  processedVideoPath: string,
  thumbnailPath: string
): Promise<{ processedStoragePath: string; thumbnailStoragePath: string }> {
  console.log('  ☁️  Uploading processed outputs to storage...');

  const paths = storageService.generatePaths(userId, videoId);

  // Upload processed video
  await storageService.uploadFromPath(
    STORAGE_BUCKETS.PROCESSED_VIDEOS,
    paths.processedVideo,
    processedVideoPath,
    'video/mp4'
  );

  // Upload thumbnail
  await storageService.uploadFromPath(
    STORAGE_BUCKETS.THUMBNAILS,
    paths.thumbnail,
    thumbnailPath,
    'image/jpeg'
  );

  console.log('  ☁️  Upload complete');

  return {
    processedStoragePath: paths.processedVideo,
    thumbnailStoragePath: paths.thumbnail,
  };
}

/**
 * Step 9: Update video record with processing results.
 */
async function updateVideoRecord(
  videoId: string,
  updates: {
    status: string;
    thumbnail_path?: string;
    duration_seconds?: number;
    width?: number;
    height?: number;
    processing_error?: string;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('videos')
    .update(updates)
    .eq('id', videoId);

  if (error) {
    throw new Error(`Failed to update video record: ${error.message}`);
  }
}

/**
 * Update processing job record.
 */
async function updateProcessingJob(
  videoId: string,
  userId: string,
  status: string,
  progress: number,
  error?: string
): Promise<void> {
  // Upsert the processing job record
  const { error: dbError } = await supabaseAdmin
    .from('processing_jobs')
    .upsert(
      {
        type: 'video_analysis',
        reference_id: videoId,
        user_id: userId,
        status,
        progress,
        error: error || null,
        ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
        ...(status === 'completed' || status === 'failed'
          ? { completed_at: new Date().toISOString() }
          : {}),
      },
      { onConflict: 'reference_id' }
    );

  // Ignore upsert errors — job tracking is non-critical
  if (dbError) {
    console.warn('Warning: Failed to update processing job:', dbError.message);
  }
}

// ============================================
// MAIN WORKER PROCESS
// ============================================

/**
 * Process a single video analysis job.
 * This is the main pipeline function called by the BullMQ worker.
 */
async function processVideoAnalysis(
  job: Job<VideoAnalysisJobData>
): Promise<void> {
  const { videoId, userId, storagePath, storageBucket } = job.data;

  console.log(`\n🎬 Processing video: ${videoId}`);
  console.log(`   Storage: ${storageBucket}/${storagePath}`);

  // Create temp directory for this job
  const tempDir = path.join(os.tmpdir(), 'highlight-reel', videoId);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Update status to processing
    await updateVideoRecord(videoId, { status: 'processing' });
    await updateProcessingJob(videoId, userId, 'running', 0);
    await job.updateProgress(5);

    // Step 1: Download raw video
    const rawPath = await downloadRawVideo(storageBucket, storagePath, tempDir);
    await job.updateProgress(15);

    // Get video metadata
    const videoInfo = await getVideoInfo(rawPath);
    console.log(
      `  📊 Video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(1)}s`
    );
    await job.updateProgress(20);

    // Step 2: Transcode
    const processedPath = await transcodeVideo(rawPath, tempDir);
    await job.updateProgress(40);

    // Step 3: Extract thumbnail
    const thumbnailPath = await extractThumbnail(processedPath, tempDir);
    await job.updateProgress(45);

    // Step 4: Extract frames
    const framesDir = await extractFrames(processedPath, tempDir);
    await job.updateProgress(55);

    // Step 5: Extract audio
    const audioPath = await extractAudio(processedPath, tempDir);
    await job.updateProgress(60);

    // Step 6: AI analysis
    let highlights: any[] = [];
    try {
      highlights = await analyzeWithAI(videoId, framesDir, audioPath);
    } catch (aiError: any) {
      // AI failure is non-fatal — video is still processed, just no auto-highlights
      console.warn(
        `  ⚠️  AI analysis failed (non-fatal): ${aiError.message}`
      );
      console.warn('  ⚠️  Video will be marked as analyzed without AI highlights.');
      console.warn('  ⚠️  User can still add manual highlights.');
    }
    await job.updateProgress(80);

    // Step 7: Save highlights to DB
    await saveHighlights(videoId, userId, highlights);
    await job.updateProgress(85);

    // Step 8: Upload processed outputs
    const { thumbnailStoragePath } = await uploadProcessedOutputs(
      userId,
      videoId,
      processedPath,
      thumbnailPath
    );
    await job.updateProgress(95);

    // Step 9: Update video record — DONE!
    await updateVideoRecord(videoId, {
      status: 'analyzed',
      thumbnail_path: thumbnailStoragePath,
      duration_seconds: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
    });
    await updateProcessingJob(videoId, userId, 'completed', 100);
    await job.updateProgress(100);

    console.log(
      `✅ Video ${videoId} processed successfully. ${highlights.length} highlights detected.`
    );
  } catch (error: any) {
    console.error(`❌ Video ${videoId} processing failed:`, error.message);

    // Update video status to failed
    await updateVideoRecord(videoId, {
      status: 'failed',
      processing_error: error.message,
    });
    await updateProcessingJob(videoId, userId, 'failed', 0, error.message);

    throw error; // Re-throw so BullMQ can retry
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`  🧹 Cleaned up temp directory`);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================
// WORKER STARTUP
// ============================================

/**
 * Create and start the video analysis worker.
 * Call this from the main server or a separate worker process.
 */
export function startVideoProcessorWorker(): Worker<VideoAnalysisJobData> {
  const worker = new Worker<VideoAnalysisJobData>(
    QUEUE_NAMES.VIDEO_ANALYSIS,
    processVideoAnalysis,
    {
      connection: getRedisConnection(),
      concurrency: 2, // Process 2 videos at a time
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed for video ${job.data.videoId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `❌ Job ${job?.id} failed for video ${job?.data.videoId}:`,
      err.message
    );
  });

  worker.on('progress', (job, progress) => {
    console.log(
      `📊 Job ${job.id} progress: ${progress}% (video: ${job.data.videoId})`
    );
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err.message);
  });

  console.log('🏭 Video processor worker started (concurrency: 2)');
  return worker;
}
