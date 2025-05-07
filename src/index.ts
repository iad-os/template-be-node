import './utils/dotenv.js';
import options from './config/options.js';
import log from './config/log.js';

const logger = log({
  tags: ['ghii-snapshot'],
});

(async () => {
  try {
    await options.waitForFirstSnapshot({
      timeout: 10000,
      onFirstSnapshot: async firstSnapshot => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug(
            { options: firstSnapshot },
            'CONFIG-SNAPSHOT-DEV - OK ✅'
          );
        } else {
          logger.info('CONFIG-SNAPSHOT - OK ✅');
        }
        await import('./main.js');
      },
    });
  } catch (err) {
    logger.error(err, 'CONFIG-SNAPSHOT - KO ❌');
  }
})();
