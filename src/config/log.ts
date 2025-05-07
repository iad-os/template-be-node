import redactOptions, { DestinationStream, LoggerOptions, pino } from 'pino';
export type LEVELS = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

type LogOptions = {
  tags?: string[];
  xRequest?: string;
  idRef?: string;
};

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

const optionsLog = (opts: LogOptions): LoggerOptions => {
  const optsLog = options();
  return {
    ...optsLog,
    base: {
      tags: opts.tags,
      'x-request': opts.xRequest,
      'id-ref': opts.idRef,
    },
  };
};

function log({
  tags = [],
  xRequest,
  idRef,
}: LogOptions): redactOptions.BaseLogger {
  return pino({
    ...optionsLog({ tags, xRequest, idRef }),
  });
}

export { log, optionsLog };
export default log;
