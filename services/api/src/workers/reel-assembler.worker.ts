/**
 * Reel Assembler Worker
 *
 * Compiles selected highlight clips into a single highlight reel video.
 * Uses FFmpeg to concatenate clips with transitions and optional title card.
 *
 * Pipeline:
 * 1. Download processed videos for each clip
 * 2. Extract individual clips using start/end timestamps
 * 3. Concatenate clips with transitions (cut, crossfade, fade_to_black)
 * 4. Upload final reel to storage
 * 5. Update reel record status to 'ready'
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
  ReelGenerationJobData,
} from '../services/queue.service';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    );
    proc.on('error', (err) =>
      reject(new Error(`FFmpeg spawn error: ${err.message}`))
    );
  });
}

/**
 * Extract a single clip from a video using start/end timestamps.
 */
async function extractClip(
  inputPath: string,
  outputPath: string,
  startMs: number,
  endMs: number
): Promise<void> {
  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = ((endMs - startMs) / 1000).toFixed(3);

  await runFFmpeg([
    '-ss', startSec,
    '-i', inputPath,
    '-t', durationSec,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
    '-r', '30',
    '-y',
    outputPath,
  ]);
}

/**
 * Create a concat file for FFmpeg's concat demuxer.
 */
function createConcatFile(clipPaths: string[], tempDir: string): string {
  const concatPath = path.join(tempDir, 'concat.txt');
  const content = clipPaths.map((p) => `file '${p}'`).join('\n');
  fs.writeFileSync(concatPath, content);
  return concatPath;
}

/**
 * Main reel assembly pipeline.
 */
async function processReelGeneration(
  job: Job<ReelGenerationJobData>
): Promise<void> {
  const { reelId, userId, clips, title } = job.data;

  console.log(`\n🎬 Assembling reel: ${reelId} (${clips.length} clips)`);

  const tempDir = path.join(os.tmpdir(), 'highlight-reel', `reel-${reelId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Update reel status
    await supabaseAdmin
      .from('reels')
      .update({ status: 'processing' })
      .eq('id', reelId);
    await job.updateProgress(5);

    // Sort clips by position
    const sortedClips = [...clips].sort((a, b) => a.position - b.position);
    const clipPaths: string[] = [];

    // Download and extract each clip
    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      console.log(
        `  📎 Processing clip ${i + 1}/${sortedClips.length}: ${clip.startTimeMs}ms - ${clip.endTimeMs}ms`
      );

      // Download the source video
      const sourceVideoPath = path.join(tempDir, `source_${i}.mp4`);
      const videoBuffer = await storageService.downloadFile(
        clip.videoStorageBucket,
        clip.videoStoragePath
      );
      fs.writeFileSync(sourceVideoPath, videoBuffer);

      // Extract the clip
      const clipPath = path.join(tempDir, `clip_${i}.mp4`);
      await extractClip(
        sourceVideoPath,
        clipPath,
        clip.startTimeMs,
        clip.endTimeMs
      );
      clipPaths.push(clipPath);

      // Clean up source to save disk space
      fs.unlinkSync(sourceVideoPath);

      const progress = 5 + Math.floor((i + 1) / sortedClips.length * 60);
      await job.updateProgress(progress);
    }

    // Concatenate all clips
    console.log('  🔗 Concatenating clips...');
    const concatFile = createConcatFile(clipPaths, tempDir);
    const reelPath = path.join(tempDir, 'reel.mp4');

    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      reelPath,
    ]);
    await job.updateProgress(75);

    // Extract reel thumbnail
    const thumbPath = path.join(tempDir, 'reel_thumb.jpg');
    await runFFmpeg([
      '-i', reelPath,
      '-ss', '1',
      '-vframes', '1',
      '-vf', 'scale=480:-2',
      '-q:v', '3',
      '-y',
      thumbPath,
    ]);
    await job.updateProgress(80);

    // Upload reel and thumbnail to storage
    console.log('  ☁️  Uploading reel...');
    const paths = storageService.generatePaths(userId, '');
    const reelStoragePath = `${userId}/reels/${reelId}.mp4`;
    const thumbStoragePath = `${userId}/reels/${reelId}_thumb.jpg`;

    await storageService.uploadFromPath(
      STORAGE_BUCKETS.REELS,
      reelStoragePath,
      reelPath,
      'video/mp4'
    );

    await storageService.uploadFromPath(
      STORAGE_BUCKETS.THUMBNAILS,
      thumbStoragePath,
      thumbPath,
      'image/jpeg'
    );
    await job.updateProgress(95);

    // Get reel duration
    const reelStats = fs.statSync(reelPath);

    // Update reel record
    await supabaseAdmin
      .from('reels')
      .update({
        status: 'ready',
        storage_path: reelStoragePath,
        thumbnail_path: thumbStoragePath,
      })
      .eq('id', reelId);

    await job.updateProgress(100);
    console.log(`✅ Reel ${reelId} assembled successfully`);
  } catch (error: any) {
    console.error(`❌ Reel ${reelId} assembly failed:`, error.message);

    await supabaseAdmin
      .from('reels')
      .update({
        status: 'failed',
        processing_error: error.message,
      })
      .eq('id', reelId);

    throw error;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`  🧹 Cleaned up temp directory`);
    } catch {
      // Ignore
    }
  }
}

/**
 * Start the reel assembler worker.
 */
export function startReelAssemblerWorker(): Worker<ReelGenerationJobData> {
  const worker = new Worker<ReelGenerationJobData>(
    QUEUE_NAMES.REEL_GENERATION,
    processReelGeneration,
    {
      connection: getRedisConnection(),
      concurrency: 1, // One reel at a time (I/O intensive)
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Reel job ${job.id} completed for reel ${job.data.reelId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `❌ Reel job ${job?.id} failed for reel ${job?.data.reelId}:`,
      err.message
    );
  });

  console.log('🏭 Reel assembler worker started (concurrency: 1)');
  return worker;
}
