import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure face-api weight files under server-assets are included in
  // serverless/output file tracing (Vercel / standalone).
  outputFileTracingIncludes: {
    "/api/**/*": ["./server-assets/face-api-models/**/*"],
    "/*": ["./server-assets/face-api-models/**/*"],
  },
  webpack(config) {
    // @tensorflow/tfjs-node and canvas are native Node binaries with
    // native addons (.node files). They cannot be bundled by webpack.
    // Mark them as external for ALL bundles (server + client).
    const nativeExternals = [
      "@tensorflow/tfjs-node",
      "@tensorflow/tfjs-node-gpu",
      "@vladmandic/face-api",
      "canvas",
      "@mapbox/node-pre-gyp",
    ];
    const existing = config.externals ?? [];
    config.externals = [
      ...(Array.isArray(existing) ? existing : [existing]),
      ...nativeExternals,
    ];
    return config;
  },
};

export default nextConfig;
