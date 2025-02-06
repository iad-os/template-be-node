import fp from 'fastify-plugin';
import type { FastifyPluginCallback } from 'fastify';
import { nanoid } from 'nanoid';

type RequestIDOpts = { requestIDName: 'x-request-id' };

const fastifyRequestID: FastifyPluginCallback<RequestIDOpts> = (
  fastify,
  opts,
  done
) => {
  fastify.decorateRequest('reqId', '');

  fastify.addHook('onRequest', (request, _reply, next) => {
    const requestIdHeader = request.headers[opts.requestIDName];
    request.reqId =
      typeof requestIdHeader === 'string' ? requestIdHeader : nanoid();
    next();
  });

  fastify.addHook('onSend', (request, reply, _payload, next) => {
    reply.header(opts.requestIDName, request.reqId);
    next();
  });

  done();
};
export default fp(fastifyRequestID);
