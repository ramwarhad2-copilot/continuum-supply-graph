import { z } from "zod";

import { ConfigurationError } from "@/lib/errors";

const schema = z.discriminatedUnion("dataSource", [
  z.object({ dataSource: z.literal("demo") }),
  z.object({
    dataSource: z.literal("cognodb"),
    uri: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1),
  }),
]);

export type AppConfig = z.infer<typeof schema>;

export function getConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppConfig {
  const dataSource = env.DATA_SOURCE === "cognodb" ? "cognodb" : "demo";
  const candidate =
    dataSource === "cognodb"
      ? {
          dataSource,
          uri: env.COGNODB_URI,
          username: env.COGNODB_USERNAME ?? "cognodb",
          password: env.COGNODB_PASSWORD,
          database: env.COGNODB_DATABASE ?? "neo4j",
        }
      : { dataSource };

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ConfigurationError(`Invalid CognoDB configuration: ${missing}`);
  }

  return parsed.data;
}
