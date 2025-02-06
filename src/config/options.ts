import { httpLoader } from '@ghii/http-loader';
import { packageJsonLoader } from '@ghii/package-json-loader';
import { yamlLoader } from '@ghii/yaml-loader';
import { Static, Type } from '@sinclair/typebox';
import log from './log.js';
import { ghii } from '@ghii/ghii-es';
import { ConnectOptions } from 'mongoose';

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
export const AuthConfig = Type.Object(
  {
    issuer: Type.String(),
    introspectionEndpoint: Type.String({
      // format: 'uri',
    }),
    realmName: Type.String(),
    ssoHost: Type.String(),
    authorizePath: Type.String(),
    tokenPath: Type.String(),
    client: Type.Object({
      clientId: Type.String(),
      clientSecret: Type.String(),
    }),
    enableCache: Type.Boolean({ default: true }),
    cacheOpts: Type.Optional(CacheConfig),
    audience: Type.Union([Type.String(), Type.Literal(false)], {
      default: false,
    }),
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
      { additionalProperties: true, default: {} }
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
    mongo: Type.Object({
      uris: Type.String({ format: 'uri', default: '' }),
      timeoutMs: Type.Integer({ default: 60000 }),
      options: Type.Optional(Type.Unsafe<ConnectOptions>(Type.Unknown())),
    }),
    waitOnTimeout: Type.Number({ default: 30 * 1000 }),
    refreshSnapshotInterval: Type.Number(),
    bulletPaths: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false }
);

export type GhiiOptions = Static<typeof GhiiOptions>;

const options = ghii(T => T.Unsafe<GhiiOptions>()).loader(
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
        : [process.cwd(), '.example.template-be-noderc.yml'])
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
