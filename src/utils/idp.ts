import QueryString from 'qs';
import waitOn from 'wait-on';
import log from '../config/log.js';
import { IssuerConfig } from '../config/options.js';
import { FastifyBaseLogger } from 'fastify';
import {
  IntrospectLikeToken,
  IntrospectLikeTokenSchema,
} from '../plugins/authorization.js';

function extractToken(token: string): string {
  const [, payload] = token.split('.');
  return payload;
}

function decodeToken(b64Payload: string): string {
  return Buffer.from(b64Payload, 'base64').toString();
}

export async function credentialsVerifier(config: IssuerConfig) {
  const wellknown = await getWellknown(config.wellKnown);

  const responseToken = await fetch(
    getWellknownKeyValue(wellknown, config.wellKnownProps.token_endpoint),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: QueryString.stringify({
        grant_type: 'client_credentials',
        client_id: config.client.clientId,
        client_secret: config.client.clientSecret,
      }),
    }
  );

  if (!responseToken.ok) {
    throw new Error('unable to authenticate');
  }
}

export function getWellknownKeyValue(wellKnown: Record<string, unknown>, key: string) {
  return wellKnown[key] as string;
}

export async function getWellknown(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  return response.json();
}

export function checkConnectivity(issuer: string, waitOnTimeout: number) {
  log({ tags: ['auth', issuer] }).info('START TO CONNECTIVITY...');
  const [protocol, uri] = issuer.split('://');
  const resource = `${protocol}-get://${uri}`;
  return waitOn({
    resources: [resource],
    timeout: waitOnTimeout,
  });
}

export function verifyToken(
  token: string,
  logger?: FastifyBaseLogger
): IntrospectLikeToken {
  try {
    const payloadEncoded = extractToken(token);
    const payloadStringify = decodeToken(payloadEncoded);
    const parsed = IntrospectLikeTokenSchema.safeParse(
      JSON.parse(payloadStringify)
    );
    if (!parsed.success) throw new Error('Invalid token payload');
    return parsed.data;
  } catch (error) {
    logger
      ? logger.warn(error, 'Invalid token format')
      : console.log('Invalid token format', error);
    throw error;
  }
}
