import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["neo4j-driver"],
  typedRoutes: true,
};

export default nextConfig;
