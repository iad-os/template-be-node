import { FastifyReply, FastifyRequest } from 'fastify';
import { isHttpError } from '../HttpError.js';
import httpStatus from 'http-status';
import { isFetchError } from '../FetchError.js';
export function errorHandler(error: unknown, _: FastifyRequest, reply: FastifyReply) {
  if (isHttpError(error)) {
    const response = {
      name: error.name,
      message: error.message,
      details: error.details,
    };
    reply.status(error.statusCode).send(response);
  } else if (isFetchError(error)) {
    reply.status(error.statusCode).send({
      name: error.name,
      message: error.message,
    });
  } else {
    reply.status(httpStatus.INTERNAL_SERVER_ERROR).send({
      message: (error as Error).message,
    });
  }
}
