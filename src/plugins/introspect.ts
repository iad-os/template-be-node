import { FastifyBaseLogger } from 'fastify';
import fp from 'fastify-plugin';
import { LRUCache } from 'lru-cache';
import qs from 'qs';
import { z } from 'zod';
import { AuthConfig } from '../config/options.js';
import { getWellknown, getWellknownKeyValue } from '../utils/idp.js';
import {
  IntrospectLikeToken,
  IntrospectLikeTokenSchema,
  IntrospectTokenError,
  IntrospectTokenErrorSchema,
} from './authorization.js';

const CacheConfigSchema = z.object({
  size: z.number().min(1).max(10000).default(1000),
  introspectTTL: z.number().min(1).default(1),
});

export const TokenIntrospectorConfigSchema = z.object({
  issuers: z.record(z.string(), z.any()),
  cache: z.union([z.literal(false), CacheConfigSchema]),
});

export type TokenIntrospectorConfig = z.infer<
  typeof TokenIntrospectorConfigSchema
>;

export default fp<TokenIntrospectorConfig>(async (fastify, ops) => {
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
  const issuers = config.issuers as AuthConfig['issuers'];

  const introspectionCache = cache<IntrospectLikeToken | IntrospectTokenError>(
    config.cache ? true : false,
    !config.cache
      ? undefined
      : { max: config.cache.size, ttl: config.cache.introspectTTL }
  );

  return async function introspect(
    token: string | undefined,
    tokenPayload: IntrospectLikeToken,
    headers: HeadersInit = {}
  ): Promise<IntrospectLikeToken | IntrospectTokenError> {
    if (!token || token.length == 0 || typeof token !== 'string')
      return { active: false, error: { code: 401 } };

    const cachedIntrospection = introspectionCache.find(token);
    if (cachedIntrospection) return cachedIntrospection;

    const { iss } = tokenPayload;
    const issuerConfig = issuers[iss];

    if (!issuerConfig) {
      return {
        active: false,
        error: {
          code: 401,
          msg: 'Invalid Client Credential not found',
        },
      };
    }

    const wellknown = await getWellknown(issuerConfig.wellKnown);

    const introspectHeaders: HeadersInit = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      authorization: toBasic(
        issuerConfig.client.clientId,
        issuerConfig.client.clientSecret
      ),
    };

    try {
      const res = await fetch(
        getWellknownKeyValue(
          wellknown,
          issuerConfig.wellKnownProps.introspection_endpoint
        ),
        {
          method: 'POST',
          headers: introspectHeaders,
          body: qs.stringify({ token }),
        }
      );
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
          const errorResponse: IntrospectTokenError = {
            active: false,
            error: { code: 401, msg: 'Token not active' },
          };
          introspectionCache.add(token, { ...errorResponse, cached: true } as IntrospectLikeToken);
          return errorResponse;
        }

        if (
          audienceVerifier({
            audience_check: issuerConfig.audience,
            audience: payload.aud,
          }) === false
        ) {
          const errorResponse: IntrospectTokenError = {
            active: false,
            error: { code: 403, msg: 'Audience check failed' },
          };
          introspectionCache.add(token, { ...errorResponse, cached: true } as IntrospectLikeToken);
          return errorResponse;
        }

        const parsed = IntrospectLikeTokenSchema.safeParse(payload);
        if (parsed.success) {
          introspectionCache.add(token, { ...parsed.data, cached: true });
        }
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
  const lru = new LRUCache<string, V, null>(
    options ?? { max: 1000, ttl: 10 }
  );
  let status = enabled;
  const add = (key: string, value: V) => {
    if (status) lru.set(key, value);
  };
  const find = (key: string): V | undefined => {
    if (status) return lru.get(key);
    return undefined;
  };
  const active = (setTo?: boolean): boolean => {
    if (setTo !== undefined) status = setTo;
    return status;
  };
  return { add, find, active };
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
  if (audience_check === false) return true;
  if (typeof audience === 'string') return audience === audience_check;
  return audience.includes(audience_check);
}

function isError(error: unknown): error is { message: string } {
  return Object.prototype.hasOwnProperty.call(error, 'message');
}

export function isInactiveToken(
  payload: unknown
): payload is IntrospectTokenError {
  return IntrospectTokenErrorSchema.safeParse(payload).success &&
    typeof payload === 'object' &&
    payload !== null &&
    'active' in payload &&
    payload.active === false;
}
