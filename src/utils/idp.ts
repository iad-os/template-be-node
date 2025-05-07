import QueryString from 'qs';
import waitOn from 'wait-on';
import log from '../config/log.js';
import { IssuerConfig } from '../config/options.js';
import { Value } from '@sinclair/typebox/value';
import { FastifyBaseLogger } from 'fastify';
import { IntrospectLikeToken } from '../plugins/authorization.js';

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

export function getWellknownKeyValue(wellKnown: any, key: string) {
  return wellKnown[key];
}

export async function getWellknown(url: string) {
  const response = await fetch(url);
  const wellknown = await response.json();
  return wellknown;
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
    return Value.Cast(IntrospectLikeToken, JSON.parse(payloadStringify));
  } catch (error) {
    logger
      ? logger.warn(error, 'Invalid token format')
      : console.log('Invalid token format', error);
    throw error;
  }
}
