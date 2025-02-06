import { Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { FastifyBaseLogger } from 'fastify';
import fp from 'fastify-plugin';
import { LRUCache } from 'lru-cache';
import qs from 'qs';
import { IntrospectLikeToken, IntrospectTokenError } from './authorization.js';
import { CacheConfig } from '../../config/options.js';

export const TokenIntrospectorConfig = Type.Object({
  issuer: Type.Object({
    clientId: Type.String({
      minLength: 1,
      examples: 'introspect-client-id',
      description: 'Client Id used to call introspect endpoint',
    }),
    clientSecret: Type.String({
      minLength: 1,
      examples: 'a-random-secret',
      description: 'Client Secret used to introspection',
    }),
    introspectionEndpoint: Type.String({ minLength: 1 }),
    audience: Type.Union([Type.String(), Type.Literal(false)], {
      default: false,
    }),
  }),
  cache: Type.Union([Type.Literal(false), CacheConfig]),
});

export type TokenIntrospectorConfig = Static<typeof TokenIntrospectorConfig>;

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default fp<TokenIntrospectorConfig>(async (fastify, ops) => {
  const configCheck = Value.Check(TokenIntrospectorConfig, ops);
  if (!configCheck) {
    throw new Error(
      `Invalid configuration: ${Array.from(
        Value.Errors(TokenIntrospectorConfig, ops)
      ).reduce((acc, e) => {
        return (acc += `${e.message} for path: ${e.path} `);
      }, '')}`
    );
  }
  // Most importantly, use declaration merging to add the custom property to the Fastify type system

  await fastify.decorate(
    'introspect',
    createTokenIntrospector({ config: ops, logger: fastify.log })
  );
});
export function createTokenIntrospector({
  config,
  logger,
}: {
  config: TokenIntrospectorConfig;
  logger: FastifyBaseLogger;
}) {
  const introspectionCache = cache<IntrospectLikeToken | IntrospectTokenError>(
    config.cache ? true : false,
    !config.cache
      ? undefined
      : { max: config.cache.size, ttl: config.cache.introspectTTL }
  );

  return async function introspect(
    token: string | undefined,
    tokenPayload?: IntrospectLikeToken,
    headers: HeadersInit = {}
  ): Promise<IntrospectLikeToken | IntrospectTokenError> {
    if (!token || token.length == 0 || typeof token !== 'string')
      return { active: false, error: { code: 401 } };

    const cachedIntrospection = introspectionCache.find(token);
    if (cachedIntrospection) return cachedIntrospection;

    let introspectHeaders: HeadersInit = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      authorization: toBasic(
        config.issuer.clientId,
        config.issuer.clientSecret
      ),
    };

    try {
      const res = await fetch(config.issuer.introspectionEndpoint, {
        method: 'POST',
        headers: introspectHeaders,
        body: qs.stringify({ token }),
      });
      if (res.ok) {
        const payload = await res.json();
        logger.debug(
          {
            ok: res.ok,
            status: res.status,
            payload,
            token,
            headers: introspectHeaders,
          },
          'Call results'
        );

        if (isInactiveToken(payload)) {
          const errorResponse = {
            active: false,
            error: {
              code: 401,
              msg: 'Token not active',
            },
          };
          introspectionCache.add(token, { ...errorResponse, cached: true });
          return errorResponse;
        }

        if (
          audienceVerifier({
            audience_check: config.issuer.audience,
            audience: payload.aud,
          }) === false
        ) {
          const errorResponse = {
            active: false,
            error: {
              code: 403,
              msg: 'Audience check failed',
            },
          };
          introspectionCache.add(token, { ...errorResponse, cached: true });
          return errorResponse;
        }

        introspectionCache.add(token, { ...payload, cached: true });
        return payload;
      }

      if (res.status === 401) {
        return {
          active: false,
          error: {
            code: 401,
            msg: 'Invalid Client Credential, unable to INTROSPECT Token',
          },
        };
      }

      return {
        active: false,
        error: { code: res.status, msg: await res.text() },
      };
    } catch (error) {
      logger.error(error, 'failed to call introspect endpoint');
      return {
        active: false,
        error: {
          code: 500,
          msg: isError(error)
            ? error.message
            : 'failed to call introspect endpoint',
        },
      };
    }
  };
}

function cache<V extends object>(
  enabled: boolean,
  options?: LRUCache.Options<string, V, null>
) {
  const cache = new LRUCache<string, V, null>(
    options ?? {
      max: 1000,
      ttl: 10,
    }
  );
  let status = enabled;
  const add: (key: string, value: V) => void = function (key, value) {
    if (status) cache.set(key, value);
  };

  const find: (key: string) => V | undefined = function (key) {
    if (status) {
      return cache.get(key);
    }
    return;
  };
  const active: (setTo?: boolean) => boolean = function (setTo) {
    if (setTo) {
      status = setTo;
    }
    return status;
  };
  return {
    add,
    find,
    active,
  };
}

function toBasic(username: string, password: string) {
  const toEncode = Buffer.from(`${username}:${password}`);
  return `Basic ${toEncode.toString('base64')}`;
}

export function audienceVerifier(audOpts: {
  audience_check: string | false;
  audience: string | string[];
}): boolean {
  const { audience_check, audience = [] } = audOpts;
  if (audience_check === false) {
    return true;
  }
  if (typeof audience === 'string') {
    return audience === audience_check;
  }
  return audience.includes(audience_check);
}

function isError(error: unknown): error is { message: string } {
  return Object.prototype.hasOwnProperty.call(error, 'message');
}

//type guard inactive token
export function isInactiveToken(
  payload: unknown
): payload is IntrospectTokenError {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'active' in payload &&
    payload.active === false
  );
}
