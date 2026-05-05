import { ghii } from '@ghii/ghii-v2';
import { zodEngine } from '@ghii/ghii-engine-zod';
import { httpLoader } from '@ghii/http-loader';
import { yamlLoader } from '@ghii/yaml-loader';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import log from './log.js';

export const CacheConfigSchema = z.object({
  size: z
    .number()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Max number of token keept in cache'),
  introspectTTL: z.number().min(1).default(1).describe('Default Time to leave'),
});

export const IssuerConfigSchema = z.object({
  wellKnown: z.string().default('http://localhost:8080/realms/mother'),
  wellKnownProps: z
    .object({
      issuer: z.string().default('issuer'),
      authorization_endpoint: z.string().default('authorization_endpoint'),
      token_endpoint: z.string().default('token_endpoint'),
      introspection_endpoint: z.string().default('introspection_endpoint'),
      userinfo_endpoint: z.string().default('userinfo_endpoint'),
      end_session_endpoint: z.string().default('end_session_endpoint'),
    })
    .default({
      issuer: 'issuer',
      authorization_endpoint: 'authorization_endpoint',
      token_endpoint: 'token_endpoint',
      introspection_endpoint: 'introspection_endpoint',
      userinfo_endpoint: 'userinfo_endpoint',
      end_session_endpoint: 'end_session_endpoint',
    }),
  audience: z.union([z.string(), z.literal(false)]).default(false),
  client: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
  }),
});

export type IssuerConfig = z.infer<typeof IssuerConfigSchema>;

export const AuthConfigSchema = z.object({
  issuers: z.record(z.string(), IssuerConfigSchema),
  enableCache: z.boolean().default(true),
  cacheOpts: CacheConfigSchema.optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const GhiiOptionsSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    dbName: z.string().optional(),
  }),
  flags: z
    .object({
      faliureCondition: z.number().default(3),
    })
    .default({ faliureCondition: 3 }),
  env: z.enum(['development', 'production']).default('development'),
  authOpts: AuthConfigSchema,
  waitOnTimeout: z.number().default(30 * 1000),
  refreshSnapshotInterval: z.number(),
  fetchInjectionOpts: z
    .object({
      headerKeys: z.array(z.string()).default(['authorization']),
    })
    .default({ headerKeys: ['authorization'] }),
  bulletPaths: z.array(z.string()).optional(),
});

export type GhiiOptions = z.infer<typeof GhiiOptionsSchema>;

const options = ghii(zodEngine(GhiiOptionsSchema));

options.loader(async () => ({}));

options.loader(async () => {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const raw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  return {
    app: {
      ...pkg,
      ...(process.env.NODE_APP_TAG_VERSION
        ? { version: process.env.NODE_APP_TAG_VERSION }
        : {}),
    },
  };
});

process.env.CONFIG_FILE &&
  options.loader(
    yamlLoader(
      {
        throwOnError: process.env.LOADER_THROW !== 'false',
        logger: (err, msg) => {
          log({ tags: ['yaml-loader'] }).info(err, msg);
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
        log({ tags: ['http-loader'] }).info(err, msg),
    })
  );

export default options;
