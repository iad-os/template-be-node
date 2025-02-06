import redactOptions, { DestinationStream, LoggerOptions, pino } from 'pino';
export type LEVELS = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const options = (): LoggerOptions | DestinationStream => ({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.PRETTY_PRINT === 'true' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

function log({
  tags = [],
  xRequest,
  idRef,
}: {
  tags?: string[];
  xRequest?: string;
  idRef?: string;
}): redactOptions.BaseLogger {
  const opts = options();
  return pino({
    ...opts,
    base: {
      tags,
      'x-request': xRequest,
      'id-ref': idRef,
    },
  });
}

export { log };
export default log;
