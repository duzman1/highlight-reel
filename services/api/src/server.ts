import { buildApp } from './app';
import { config, validateConfig } from './config';

async function start() {
  validateConfig();

  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`
  🏟️  HighlightReel API Server
  ────────────────────────────
  Local:   http://localhost:${config.port}
  Health:  http://localhost:${config.port}/health
  Env:     ${config.nodeEnv}
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
