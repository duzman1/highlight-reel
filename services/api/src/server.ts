import { buildApp } from './app';
import { config, validateConfig } from './config';
import { startVideoProcessorWorker } from './workers/video-processor.worker';
import { startReelAssemblerWorker } from './workers/reel-assembler.worker';
import { closeQueues } from './services/queue.service';

async function start() {
  validateConfig();

  const app = await buildApp();

  // Start background workers
  const videoWorker = startVideoProcessorWorker();
  const reelWorker = startReelAssemblerWorker();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Close workers first (let in-progress jobs finish)
    await videoWorker.close();
    await reelWorker.close();

    // Close queue connections
    await closeQueues();

    // Close HTTP server
    await app.close();

    console.log('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`
  🏟️  HighlightReel API Server
  ────────────────────────────
  Local:   http://localhost:${config.port}
  Health:  http://localhost:${config.port}/health
  Env:     ${config.nodeEnv}
  Workers: video-processor, reel-assembler
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
