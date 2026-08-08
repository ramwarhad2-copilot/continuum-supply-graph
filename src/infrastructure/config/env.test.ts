import { describe, expect, it } from "vitest";

import { getConfig } from "@/infrastructure/config/env";
import { ConfigurationError } from "@/lib/errors";

describe("environment configuration", () => {
  it("defaults to safe demo mode", () => {
    expect(getConfig({})).toEqual({ dataSource: "demo" });
  });

  it("does not allow partial CognoDB credentials", () => {
    expect(() => getConfig({ DATA_SOURCE: "cognodb", COGNODB_URI: "bolt+s://example" })).toThrow(
      ConfigurationError,
    );
  });
});
