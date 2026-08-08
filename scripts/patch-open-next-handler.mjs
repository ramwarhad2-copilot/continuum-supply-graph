import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const marker = "continuum-open-next-require-shim";
const handlerPath = path.join(
  process.cwd(),
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs",
);

const source = await readFile(handlerPath, "utf8");

if (!source.includes(marker)) {
  const firstLineEnd = source.indexOf("\n");

  if (firstLineEnd === -1 || !source.startsWith("import ")) {
    throw new Error("Unexpected OpenNext handler format; require shim was not applied.");
  }

  const shim = `
// ${marker}
const require = (specifier) => {
  const builtin = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const loaded = process.getBuiltinModule(builtin);

  if (!loaded) {
    throw new Error(\`Unsupported runtime module: \${specifier}\`);
  }

  return loaded;
};
`;

  const patched = `${source.slice(0, firstLineEnd + 1)}${shim}${source.slice(firstLineEnd + 1)}`;
  await writeFile(handlerPath, patched, "utf8");
}
