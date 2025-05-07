import { Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { AuthConfig } from '../config/options.js';
import { Header } from '../types/fastify.js';
import { verifyToken } from '../utils/token.js';

export const IntrospectLikeToken = Type.Object({
  active: Type.Boolean({
    description:
      'REQUIRED. Boolean indicator of whether or not the presented token is currently active. The specifics of a token\'s "active" state will vary depending on the implementation of the authorization server and the information it keeps about its tokens, but a "true" value return for the "active" property will generally indicate that a given token has been issued by this authorization server, has not been revoked by the resource owner, and is within its given time window of validity (e.g., after its issuance time and before its expiration time).',
  }),
  iss: Type.String({
    description:
      'The "iss" (issuer) claim identifies the principal that issued the JWT. The processing of this claim is generally application specific. The "iss" value is a case-sensitive string containing a StringOrURI value',
  }),

  exp: Type.Number({
    description:
      'The "exp" (expiration time) claim identifies the expiration time on or after which the JWT MUST NOT be accepted for processing. The processing of the "exp" claim requires that the current date/time MUST be before the expiration date/time listed in the "exp" claim',
  }),
  aud: Type.Union([
    Type.String({
      description:
        'The "aud" (audience) claim identifies the recipients that the JWT is intended for. Each principal intended to process the JWT MUST identify itself with a value in the audience claim. If the principal processing the claim does not identify itself with a value in the "aud" claim when this claim is present, then the JWT MUST be rejected. In the general case, the "aud" value is an array of case- sensitive strings, each containing a StringOrURI value. In the special case when the JWT has one audience, the "aud" value MAY be a single case-sensitive string containing a StringOrURI value. The interpretation of audience values is generally application specific.',
    }),
    Type.Array(
      Type.String({
        description:
          'the "aud" value is an array of case- sensitive strings, each containing a StringOrURI value. In the special case when the JWT has one audience, the "aud" value MAY be a single case-sensitive string containing a StringOrURI value.',
      }),
      { default: [] }
    ),
  ]),
  sub: Type.String({
    description:
      'The "sub" (subject) claim identifies the principal that is the subject of the JWT. The claims in a JWT are normally statements about the subject. The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique. The processing of this claim is generally application specific. The "sub" value is a case-sensitive string containing a StringOrURI value.',
  }),
  iat: Type.Number({
    description:
      'The "iat" (issued at) claim identifies the time at which the JWT was issued. This claim can be used to determine the age of the JWT. Its value MUST be a number containing a NumericDate value.',
  }),
  azp: Type.String(),
  jti: Type.String({
    description:
      'The "jti" (JWT ID) claim provides a unique identifier for the JWT. The identifier value MUST be assigned in a manner that ensures that there is a negligible probability that the same value will be accidentally assigned to a different data object; if the application uses multiple issuers, collisions MUST be prevented among values produced by different issuers as well. The "jti" claim can be used to prevent the JWT from being replayed. The "jti" value is a case- sensitive string.',
  }),
  email: Type.Optional(Type.String()),
  token_type: Type.Optional(
    Type.String({
      description:
        ' Type of the token as defined in Section 5.1 of OAuth2.0 [RFC6749].',
    })
  ),
  scope: Type.Optional(
    Type.String({
      description:
        'A JSON string containing a space-separated list of scopes associated with this token, in the format described in Section 3.3 of OAuth 2.0 [RFC6749].',
    })
  ),
  client_id: Type.Optional(
    Type.String({
      description:
        'Client identifier for the OAuth 2.0 client that requested this token.',
    })
  ),
  username: Type.Optional(
    Type.String({
      description:
        ' Human-readable identifier for the resource owner who authorized this token',
    })
  ),
  resource_access: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({ roles: Type.Array(Type.String(), { default: [] }) })
    )
  ),
  realm_access: Type.Optional(
    Type.Object({
      roles: Type.Array(Type.String(), { default: [] }),
    })
  ),
  cached: Type.Boolean({
    default: false,
  }),
});

export const IntrospectTokenError = Type.Object({
  active: Type.Boolean({
    description:
      'REQUIRED. Boolean indicator of whether or not the presented token is currently active. The specifics of a token\'s "active" state will vary depending on the implementation of the authorization server and the information it keeps about its tokens, but a "true" value return for the "active" property will generally indicate that a given token has been issued by this authorization server, has not been revoked by the resource owner, and is within its given time window of validity (e.g., after its issuance time and before its expiration time).',
  }),
  error: Type.Optional(
    Type.Object({
      code: Type.Optional(Type.Number({ description: 'status code error' })),
      msg: Type.Optional(
        Type.String({ description: 'introspect token error' })
      ),
    })
  ),
});

export type IntrospectLikeToken = Static<typeof IntrospectLikeToken>;
export type IntrospectTokenError = Static<typeof IntrospectTokenError>;

export default fp<AuthConfig>(
  async (fastify, opts) => {
    const configCheck = Value.Check(AuthConfig, opts);
    if (!configCheck) {
      throw new Error(
        `Invalid configuration: ${Array.from(
          Value.Errors(AuthConfig, opts)
        ).reduce((acc, e) => {
          return (acc += `${e.message} for path: ${e.path} `);
        }, '')}`
      );
    }
    const { httpErrors } = fastify;

    fastify.decorate(
      'authorize',
      createAuthorize({
        logger: fastify.log,
        httpErrors,
        introspect: fastify.introspect,
      })
    );
    // decorate request with user data extract from token
    fastify.decorateRequest('user');
  },
  {
    // Protip: if you name your plugins, the stack trace in case of errors
    //         will be easier to read and other plugins can declare their dependency
    //         on this one. `fastify-autoload` will take care of loading the plugins
    //         in the correct order.
    name: 'authorization',
  }
);

function isErrorIntrospect(res: unknown): res is IntrospectTokenError {
  return Value.Check(IntrospectTokenError, res) && res.active === false;
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
  return async function authorize(
    req: FastifyRequest<{ Headers: Header }>,
    reply: FastifyReply
  ) {
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
    const tokenDataInspect = Value.Cast(IntrospectLikeToken, introspection);
    req.user = tokenDataInspect;
  };
}
