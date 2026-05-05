import {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { AuthConfig } from '../config/options.js';
import { verifyToken } from '../utils/idp.js';

export const IntrospectLikeTokenSchema = z.object({
  active: z.boolean(),
  iss: z.string(),
  exp: z.number(),
  aud: z.union([z.string(), z.array(z.string()).default([])]),
  sub: z.string(),
  iat: z.number(),
  azp: z.string(),
  jti: z.string(),
  email: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  client_id: z.string().optional(),
  username: z.string().optional(),
  resource_access: z
    .record(z.string(), z.object({ roles: z.array(z.string()).default([]) }))
    .optional(),
  realm_access: z
    .object({ roles: z.array(z.string()).default([]) })
    .optional(),
  cached: z.boolean().default(false),
});

export const IntrospectTokenErrorSchema = z.object({
  active: z.literal(false),
  error: z
    .object({
      code: z.number().optional(),
      msg: z.string().optional(),
    })
    .optional(),
});

export type IntrospectLikeToken = z.infer<typeof IntrospectLikeTokenSchema>;
export type IntrospectTokenError = z.infer<typeof IntrospectTokenErrorSchema>;

export default fp<AuthConfig>(
  async (fastify, opts) => {
    const { httpErrors } = fastify;

    fastify.decorate(
      'authorize',
      createAuthorize({
        logger: fastify.log,
        httpErrors,
        introspect: fastify.introspect,
      })
    );
    fastify.decorateRequest('user');
  },
  {
    name: 'authorization',
  }
);

function isErrorIntrospect(res: unknown): res is IntrospectTokenError {
  const parsed = IntrospectTokenErrorSchema.safeParse(res);
  return parsed.success && parsed.data.active === false;
}

export function createAuthorize({
  logger,
  introspect,
  httpErrors,
}: {
  logger: FastifyBaseLogger;
  introspect: FastifyInstance['introspect'];
  httpErrors: FastifyInstance['httpErrors'];
}) {
  return async function authorize(req: FastifyRequest, reply: FastifyReply) {
    const authz = req.headers.authorization;

    if (!authz) {
      reply
        .status(401)
        .send(httpErrors.unauthorized('Missing Autorization Token !'));
      return;
    }

    const [type, token, ...shouldBeNull] = authz.split(' ');
    const tokenPayload = verifyToken(token, logger);

    if (type !== 'Bearer' || shouldBeNull.length > 0) {
      reply
        .status(401)
        .send(
          httpErrors.unauthorized('Authorization not supported or invalid')
        );
      return;
    }

    const introspection = await introspect(token, tokenPayload, {
      'x-wl-sso': 'introspect',
    });

    if (isErrorIntrospect(introspection)) {
      logger.info(
        {
          introspection,
          authorization: req.headers.authorization,
          error: introspection?.error,
        },
        'Introspection Failed 💣💣'
      );
      if (introspection.error?.code === 403) {
        reply
          .status(403)
          .send(httpErrors.forbidden('Authorization not supported or invalid'));
        return;
      }
      reply
        .status(401)
        .send(
          httpErrors.unauthorized('Authorization not supported or invalid')
        );
      return;
    }

    const parsed = IntrospectLikeTokenSchema.safeParse(introspection);
    if (!parsed.success) {
      reply.status(401).send(httpErrors.unauthorized('Invalid token payload'));
      return;
    }
    req.user = parsed.data;
  };
}
