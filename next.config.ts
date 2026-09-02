import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The package resolves its platform binary relative to its own module path.
  // Keep that Node resolution intact instead of bundling it into a route chunk.
  serverExternalPackages: ["ffmpeg-static"],
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/api/public/branding/favicon-root",
      },
    ];
  },
  experimental: {
    // The installed Next runtime clones request bodies at 10 MiB by default.
    // Master Artwork accepts at most 20 MiB of raw binary data; keep a small
    // transport margin while exact length/checksum verification stays mandatory.
    middlewareClientMaxBodySize: 21 * 1024 * 1024,
  },
  // Ensure native/runtime assets are included in serverless output tracing
  // (Vercel / standalone).
  outputFileTracingIncludes: {
    "/api/ugc-video-studio/generate": ["./node_modules/ffmpeg-static/ffmpeg"],
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
