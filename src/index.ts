import dotenv from 'dotenv';
import options from './config/options.js';
import log from './config/log.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(process.env);

const mainFileName =
  process.env.NODE_ENV === 'development' ? './main' : './main.js';

const logger = log({
  tags: ['ghii-snapshot'],
});

try {
  await options.waitForFirstSnapshot(
    { timeout: 10000 },
    __dirname,
    mainFileName
  );
  logger.debug({ options: options.snapshot() }, 'CONFIG-SNAPSHOT - OK');
} catch (err) {
  logger.error(err, 'CONFIG-SNAPSHOT - KO');
}
