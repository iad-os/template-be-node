import { z } from 'zod';
import { GhiiOptions, AuthConfig } from '../config/options.js';
import {
  IntrospectLikeToken,
  createAuthorize,
} from '../plugins/authorization.js';
import {
  FetchInjectionOpts,
  createFetchInjection,
} from '../plugins/fetchInjection.js';
import {
  TokenIntrospectorConfig,
  createTokenIntrospector,
} from '../plugins/introspect.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: IntrospectLikeToken;
    reqId: string;
    fetch: <T>(...params: Parameters<typeof fetch>) => Promise<T>;
  }
  interface FastifyInstance {
    introspect: ReturnType<typeof createTokenIntrospector>;
    authorize: ReturnType<typeof createAuthorize>;
    fetchInjection: ReturnType<typeof createFetchInjection>;
  }
}

export type MPlugins = {
  authorization: AuthConfig;
  introspector: TokenIntrospectorConfig;
  main: Omit<GhiiOptions, 'authOpts'>;
  fetchInjection: FetchInjectionOpts;
};

export const HeaderSchema = z.object({
  authorization: z.string().describe('Authorization bearer'),
});
export type Header = z.infer<typeof HeaderSchema>;
