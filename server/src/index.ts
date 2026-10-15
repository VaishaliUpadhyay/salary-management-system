import { createApp } from './app.js';
import { readEnv } from './lib/env.js';

const env = readEnv();
const server = createApp().listen(env.PORT, '127.0.0.1', () => {
  console.info(`API scaffold listening on port ${env.PORT}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close());
}
