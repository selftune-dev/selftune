import * as Schema from "effect/Schema";
import type * as Predicate from "effect/Predicate";
const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

// SAFETY-UNKNOWN: Only used within the schema boundary; the merged result is validated below.
function restoreExtensions(
  original: unknown,
  decoded: unknown,
  validate: Predicate.Predicate<unknown>,
): unknown {
  if (Array.isArray(decoded) && Array.isArray(original)) {
    return decoded.map((value, index) =>
      restoreExtensions(original[index], value, (child) =>
        validate(decoded.map((entry, position) => (position === index ? child : entry))),
      ),
    );
  }
  if (isRecord(original) && isRecord(decoded)) {
    let result = { ...decoded };
    for (const [key, value] of Object.entries(original)) {
      const child = Object.hasOwn(decoded, key)
        ? restoreExtensions(value, decoded[key], (candidate) =>
            validate({ ...result, [key]: candidate }),
          )
        : value;
      const candidate = { ...result, [key]: child };
      if (validate(candidate)) result = candidate;
    }
    return result;
  }
  return decoded;
}

/** Validate identity-shaped local records without stripping forward-compatible fields. */
export function preservingDecoder<A>(schema: Schema.Decoder<A>) {
  const isDecoded = Schema.is(Schema.toType(schema));
  const decode = Schema.decodeUnknownSync(schema);
  // SAFETY-UNKNOWN: Schema.is validates the complete decoded value before returning it.
  const decodePreserving = (value: unknown): A => {
    if (isDecoded(value)) return value;
    const decoded = decode(value);
    const merged = restoreExtensions(value, decoded, isDecoded);
    return isDecoded(merged) ? merged : decoded;
  };
  return decodePreserving;
}

export function preservingJsonDecoder<A>(schema: Schema.Decoder<A>) {
  const parse = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
  const decode = preservingDecoder(schema);
  return (text: string): A => decode(parse(text));
}
