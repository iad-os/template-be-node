import { Value } from '@sinclair/typebox/value';
import { FastifyBaseLogger } from 'fastify';
import { IntrospectLikeToken } from '../plugins/authorization.js';

export function extractToken(token: string): string {
  const [, payload] = token.split('.');
  return payload;
}

export function decodeToken(b64Payload: string): string {
  return Buffer.from(b64Payload, 'base64').toString();
}

export function verifyToken(
  token: string,
  logger?: FastifyBaseLogger
): IntrospectLikeToken | undefined {
  try {
    const payloadEncoded = extractToken(token);
    const payloadStringify = decodeToken(payloadEncoded);
    return Value.Cast(IntrospectLikeToken, JSON.parse(payloadStringify));
  } catch (error) {
    logger
      ? logger.warn(error, 'Invalid token format')
      : console.log('Invalid token format', error);
  }
}
