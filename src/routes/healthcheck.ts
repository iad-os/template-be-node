import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import irene from '../config/Irene.js';
import type { MPlugins } from '../types/fastify.js';

export const autoPrefix = '/healthcheck';

/**
 * This plugin contains all operation about key management
 */
const healthcheck: FastifyPluginAsync<MPlugins['main']> = async fastify => {
  // Every route inside this plugin should be protected
  // by our authorization logic. The easiest way to do it,
  // is by adding an hook that runs our authorization code.
  // You should always run your authorization as soon as possible
  // in the request/response lifecycle!
  //fastify.addHook('onRequest', authorize);

  fastify.route({
    method: 'GET',
    url: '/',
    handler: healthcheck,
  });
  async function healthcheck(req: FastifyRequest, reply: FastifyReply) {
    const hcInfos = await checkApplicationStatus();
    fastify.log.info(`⚙️  APPLICATION HEALTH -> ${JSON.stringify(hcInfos)}`);
    if (!hcInfos.healthy) {
      reply.status(500).send({ status: 'ko' });
      return;
    }
    reply.status(200).send({ status: 'ok' });
  }

  async function checkApplicationStatus() {
    return irene.healthcheck();
  }
};

export default healthcheck;
