import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import { preservingJsonDecoder } from "./preserving-schema.js";

test("local identity records retain unknown fields at every nesting level", () => {
  const decode = preservingJsonDecoder(
    Schema.Struct({ nested: Schema.Struct({ known: Schema.String }) }),
  );
  const record = { nested: { known: "yes", future: [1, 2] }, version: 2 };
  expect(decode(JSON.stringify(record))).toEqual(record);
  expect(() => decode('{"nested":{"known":42}}')).toThrow();
  expect(() => decode("invalid JSON")).toThrow();
});

test("codec transformations still decode when the input is not already a valid decoded value", () => {
  const decode = preservingJsonDecoder(Schema.NumberFromString);
  expect(decode('"42"')).toBe(42);
});
