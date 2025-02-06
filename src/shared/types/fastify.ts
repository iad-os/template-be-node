import { Static, Type } from '@sinclair/typebox';
import { GhiiOptions, AuthConfig } from '../../config/options.js';
import {
  IntrospectLikeToken,
  createAuthorize,
} from '../plugins/authorization.js';
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
  }
}

export type MPlugins = {
  authorization: AuthConfig;
  introspector: TokenIntrospectorConfig;
  main: Omit<GhiiOptions, 'authOpts'>;
};

export type Header = Static<typeof Header>;
export const Header = Type.Object({
  authorization: Type.String({
    description: 'Authorization bearer',
  }),
});
