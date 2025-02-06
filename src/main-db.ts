import log from './config/log.js';
import { awaitConnection, closeConnection } from './config/mongodb.js';
import opts from './config/options.js';
import ConnectionTestMongo from './shared/models/connectionTest.js';

async function start(): Promise<void> {
  try {
    await awaitConnection(opts.snapshot().mongo);
  } catch (err) {
    log({ tags: ['mongo', 'error'] }).debug('💥 ops', err);
    throw err;
  }
}

async function stop(): Promise<void> {
  await closeConnection();
}

async function checkDb(logger: ReturnType<typeof log>): Promise<void> {
  const { timeoutMs } = opts.snapshot().mongo;
  let isCompleted = false;
  return new Promise(async (resolve, reject) => {
    try {
      setTimeout(() => {
        if (!isCompleted) {
          const mex = '💥 ops... Connection timeout';
          logger.error(mex);
          reject(new Error(mex));
        }
      }, timeoutMs);
      logger.info({ timeoutMs }, '⏳ check mongo connection');
      const testModel = await new ConnectionTestMongo({
        options: opts.snapshot().mongo.options,
      });
      const { _id } = await testModel.save();
      const result = await ConnectionTestMongo.findOneAndDelete({ _id });

      if (!result) {
        reject(new Error('Expected object with _id ' + _id + ' not found'));
      }
      resolve();
      isCompleted = true;
    } catch (error) {
      reject(error);
      logger.error(error);
    }
  });
}

export { checkDb, start, stop };
