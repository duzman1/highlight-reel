/**
 * Queue Service
 *
 * BullMQ job queue setup for async video processing.
 * Provides:
 * - Video analysis queue (raw video → AI highlights)
 * - Reel generation queue (selected clips → compiled reel)
 * - Job progress tracking
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

// Shared Redis connection for all queues
let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    redisConnection.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redisConnection.on('connect', () => {
      console.log('📡 Connected to Redis');
    });
  }

  return redisConnection;
}

// ============================================
// QUEUE NAMES
// ============================================
export const QUEUE_NAMES = {
  VIDEO_ANALYSIS: 'video-analysis',
  REEL_GENERATION: 'reel-generation',
} as const;

// ============================================
// JOB DATA TYPES
// ============================================
export interface VideoAnalysisJobData {
  videoId: string;
  userId: string;
  storagePath: string;
  storageBucket: string;
}

export interface ReelGenerationJobData {
  reelId: string;
  userId: string;
  clips: {
    highlightId: string;
    videoStoragePath: string;
    videoStorageBucket: string;
    startTimeMs: number;
    endTimeMs: number;
    position: number;
    transitionType: string;
  }[];
  title: string;
}

// ============================================
// QUEUE INSTANCES
// ============================================
let videoAnalysisQueue: Queue<VideoAnalysisJobData> | null = null;
let reelGenerationQueue: Queue<ReelGenerationJobData> | null = null;

export function getVideoAnalysisQueue(): Queue<VideoAnalysisJobData> {
  if (!videoAnalysisQueue) {
    videoAnalysisQueue = new Queue<VideoAnalysisJobData>(
      QUEUE_NAMES.VIDEO_ANALYSIS,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
          },
          removeOnFail: {
            count: 50,
          },
        },
      }
    );
  }
  return videoAnalysisQueue;
}

export function getReelGenerationQueue(): Queue<ReelGenerationJobData> {
  if (!reelGenerationQueue) {
    reelGenerationQueue = new Queue<ReelGenerationJobData>(
      QUEUE_NAMES.REEL_GENERATION,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 50,
          },
          removeOnFail: {
            count: 50,
          },
        },
      }
    );
  }
  return reelGenerationQueue;
}

// ============================================
// HELPER: Enqueue jobs
// ============================================

/**
 * Enqueue a video for AI analysis.
 * Called after a video upload is confirmed.
 */
export async function enqueueVideoAnalysis(
  data: VideoAnalysisJobData
): Promise<string> {
  const queue = getVideoAnalysisQueue();
  const job = await queue.add(`analyze-${data.videoId}`, data, {
    priority: 1,
  });
  console.log(
    `📥 Enqueued video analysis job: ${job.id} for video ${data.videoId}`
  );
  return job.id!;
}

/**
 * Enqueue a reel for generation.
 * Called when a user requests a highlight reel.
 */
export async function enqueueReelGeneration(
  data: ReelGenerationJobData
): Promise<string> {
  const queue = getReelGenerationQueue();
  const job = await queue.add(`reel-${data.reelId}`, data, {
    priority: 2,
  });
  console.log(
    `📥 Enqueued reel generation job: ${job.id} for reel ${data.reelId}`
  );
  return job.id!;
}

/**
 * Get the status of a job by ID.
 */
export async function getJobStatus(
  queueName: string,
  jobId: string
): Promise<{
  status: string;
  progress: number;
  error?: string;
} | null> {
  const queue =
    queueName === QUEUE_NAMES.VIDEO_ANALYSIS
      ? getVideoAnalysisQueue()
      : getReelGenerationQueue();

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    status: state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    error: job.failedReason,
  };
}

/**
 * Gracefully close all queue connections.
 */
export async function closeQueues(): Promise<void> {
  await videoAnalysisQueue?.close();
  await reelGenerationQueue?.close();
  await redisConnection?.quit();

  videoAnalysisQueue = null;
  reelGenerationQueue = null;
  redisConnection = null;
}
