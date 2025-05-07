import { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { pick } from 'lodash-es';
import { FetchError } from '../errors/FetchError.js';

export type FetchInjectionOpts = {
  headerKeys: string[];
};

export default fp<FetchInjectionOpts>(
  async (fastify, opts) => {
    fastify.decorate(
      'fetchInjection',
      createFetchInjection({
        logger: fastify.log,
        opts,
      })
    );
    fastify.decorateRequest('fetch');
  },
  {
    // Protip: if you name your plugins, the stack trace in case of errors
    //         will be easier to read and other plugins can declare their dependency
    //         on this one. `fastify-autoload` will take care of loading the plugins
    //         in the correct order.
    name: 'fetchInjection',
  }
);

export function createFetchInjection({
  logger,
  opts,
}: {
  logger: FastifyBaseLogger;
  opts: FetchInjectionOpts;
}) {
  return async function fetchInjection(
    req: FastifyRequest,
    reply: FastifyReply
  ) {
    req.fetch = createFetch({ req, logger, opts });
  };
}

const createFetch = ({
  req,
  logger,
  opts,
}: {
  req: FastifyRequest;
  logger: FastifyBaseLogger;
  opts: FetchInjectionOpts;
}) => {
  const headers = pick(req.headers, opts.headerKeys) as Record<string, string>;

  return async function <T>(...params: Parameters<typeof fetch>) {
    const [input, _init] = params;
    const init = {
      ...(_init ?? {}),
      headers: {
        ...headers,
        ...(_init?.headers ?? {}),
      },
    };
    const response = await fetch(input, init);
    if (response.ok) {
      const json = await response.json();
      logger.debug({ input, init }, 'Fetch success ✅');
      return json;
    }
    const error = new FetchError({
      error: response.statusText,
      message: await response.text(),
      statusCode: response.status,
    });
    logger.error({ input, init, err: error }, 'Fetch error ❌');
    throw error;
  };
};
