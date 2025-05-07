import { ghii } from '@ghii/ghii-es';
import { httpLoader } from '@ghii/http-loader';
import { packageJsonLoader } from '@ghii/package-json-loader';
import { yamlLoader } from '@ghii/yaml-loader';
import { Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import log from './log.js';

export const CacheConfig = Type.Object(
  {
    size: Type.Number({
      minimum: 1,
      maximum: 10000,
      description: 'Max number of token keept in cache',
      default: 1000,
    }),
    introspectTTL: Type.Number({
      minimum: 1,
      description: 'Default Time to leave',
      default: 1,
    }),
  },
  { description: 'Information required to verify token issued by a issuer' }
);
export const IssuerConfig = Type.Object(
  {
    wellKnown: Type.String({
      // format: 'uri',
      default: 'http://localhost:8080/realms/mother',
    }),
    wellKnownProps: Type.Object(
      {
        issuer: Type.String({ default: 'issuer' }),
        authorization_endpoint: Type.String({
          default: 'authorization_endpoint',
        }),
        token_endpoint: Type.String({ default: 'token_endpoint' }),
        introspection_endpoint: Type.String({
          default: 'introspection_endpoint',
        }),
        userinfo_endpoint: Type.String({ default: 'userinfo_endpoint' }),
        end_session_endpoint: Type.String({ default: 'end_session_endpoint' }),
      },
      { default: {}, additionalProperties: false }
    ),
    audience: Type.Union([Type.String(), Type.Literal(false)], {
      default: false,
    }),
    client: Type.Object({
      clientId: Type.String(),
      clientSecret: Type.String(),
    }),
  },
  { additionalProperties: false }
);
export type IssuerConfig = Static<typeof IssuerConfig>;
export const AuthConfig = Type.Object(
  {
    issuers: Type.Record(Type.String(), IssuerConfig),
    enableCache: Type.Boolean({ default: true }),
    cacheOpts: Type.Optional(CacheConfig),
  },
  { additionalProperties: false }
);

export type AuthConfig = Static<typeof AuthConfig>;
export const GhiiOptions = Type.Object(
  {
    app: Type.Object(
      {
        name: Type.String(),
        version: Type.String(),
        description: Type.String(),
        dbName: Type.Optional(Type.String()),
      },
      { additionalProperties: true }
    ),
    flags: Type.Object(
      {
        faliureCondition: Type.Number({ default: 3 }),
      },
      { additionalProperties: false, default: {} }
    ),
    env: Type.Union([Type.Literal('development'), Type.Literal('production')], {
      default: 'development',
    }),
    authOpts: AuthConfig,
    waitOnTimeout: Type.Number({ default: 30 * 1000 }),
    refreshSnapshotInterval: Type.Number(),
    fetchInjectionOpts: Type.Object(
      {
        headerKeys: Type.Array(Type.String(), {
          default: ['authorization'],
        }),
      },
      { default: {} }
    ),
    bulletPaths: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false }
);

export type GhiiOptions = Static<typeof GhiiOptions>;

const options = ghii(GhiiOptions).loader(async () => {
  const defaultConfig = Value.Default(GhiiOptions, {});
  return defaultConfig as Record<string, unknown>;
});

options.loader(
  packageJsonLoader({
    target: 'app',
    map: p => ({
      ...p,
      ...(process.env.NODE_APP_TAG_VERSION
        ? { version: process.env.NODE_APP_TAG_VERSION }
        : {}),
    }),
  })
);

process.env.CONFIG_FILE &&
  options.loader(
    yamlLoader(
      {
        throwOnError: process.env.LOADER_THROW !== 'false',
        logger: (err, msg) => {
          log({
            tags: ['yaml-loader'],
          }).info(err, msg);
        },
      },
      ...(process.env.CONFIG_FILE
        ? [process.env.CONFIG_FILE]
        : [process.cwd(), '.template-be-noderc.yml'])
    )
  );

process.env.WELL_KNOWN_URL &&
  options.loader(
    httpLoader(process.env.WELL_KNOWN_URL!, {
      throwOnError: process.env.NODE_ENV !== 'development',
      logger: (err, msg) =>
        log({
          tags: ['http-loader'],
        }).info(err, msg),
    })
  );

export default options;
