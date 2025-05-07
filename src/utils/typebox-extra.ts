import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  FormatRegistry,
  SchemaOptions,
  TSchema,
  Type,
} from '@sinclair/typebox';
import {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import validator from 'validator';

const { isDate, isEmail, isISO8601, isTime, isUUID, isURL, isIP } = validator;
//github.com/fastify/fastify/discussions/3357#discussioncomment-3323667
export const DateTime = (options?: SchemaOptions) =>
  Type.Unsafe<Date>({
    ...options,
    type: 'string',
    format: 'date-time',
  });

export const Nullable = <T extends TSchema>(type: T) =>
  Type.Union([type, Type.Null()]);

export type FastifyTypebox = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

// -------------------------------------------------------------------------------------------
// Format Registration
// -------------------------------------------------------------------------------------------

FormatRegistry.Set('date-time', value => isISO8601(value));
FormatRegistry.Set('date', value => isDate(value));
FormatRegistry.Set('time', value => isTime(value));
FormatRegistry.Set('email', value => isEmail(value));
FormatRegistry.Set('uuid', value => isUUID(value));
FormatRegistry.Set('url', value => isURL(value));
FormatRegistry.Set('ipv6', value => isIP(value, 6));
FormatRegistry.Set('ipv4', value => isIP(value, 4));
//FormatRegistry.Set('Date', (value) => value instanceof Date)
