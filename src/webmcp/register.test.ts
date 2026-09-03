import { describe, expect, it } from "vitest";
import { addToQuoteRequest, getProduct } from "../capabilities";
import { toInputSchema } from "./register";

describe("toInputSchema", () => {
  it("keeps defaulted fields optional and drops $schema", () => {
    const s = toInputSchema(addToQuoteRequest.input) as { required?: string[]; $schema?: string; additionalProperties?: boolean };
    expect(s.$schema).toBeUndefined();
    expect(s.required).toEqual(["lines"]);
    expect(s.additionalProperties).toBe(false);
  });
  it("empty input is a plain object schema", () => {
    expect(toInputSchema(getProduct.input)).toEqual({ type: "object", properties: {}, additionalProperties: false });
  });
});
