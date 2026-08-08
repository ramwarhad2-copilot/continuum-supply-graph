import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const requireMarker = "continuum-open-next-require-shim";
const tlsMarker = "continuum-open-next-tls-option-patched";
const unsupportedTlsOption = "rejectUnauthorized:!1,";
const handlerPath = path.join(
  process.cwd(),
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs",
);

const source = await readFile(handlerPath, "utf8");
let patched = source;

if (!patched.includes(requireMarker)) {
  const firstLineEnd = source.indexOf("\n");

  if (firstLineEnd === -1 || !source.startsWith("import ")) {
    throw new Error("Unexpected OpenNext handler format; require shim was not applied.");
  }

  const shim = `
// ${requireMarker}
const require = (specifier) => {
  const builtin = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const loaded = process.getBuiltinModule(builtin);

  if (!loaded) {
    throw new Error(\`Unsupported runtime module: \${specifier}\`);
  }

  return loaded;
};
`;

  patched = `${source.slice(0, firstLineEnd + 1)}${shim}${source.slice(firstLineEnd + 1)}`;
}

if (!patched.includes(tlsMarker)) {
  if (!patched.includes(unsupportedTlsOption)) {
    throw new Error("Expected Neo4j TLS option was not found in the OpenNext handler.");
  }

  patched = patched
    .replaceAll(unsupportedTlsOption, "")
    .replace(`// ${requireMarker}`, `// ${requireMarker}\n// ${tlsMarker}`);
}

if (patched.includes(unsupportedTlsOption)) {
  throw new Error("Unsupported Neo4j TLS option remains in the OpenNext handler.");
}

await writeFile(handlerPath, patched, "utf8");
