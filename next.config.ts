import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext Cloudflare deployment; see wrangler.toml + README.
};

export default nextConfig;

// Best-effort local bindings for `next dev`. Ignore failures in CI/build sandboxes.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  void initOpenNextCloudflareForDev();
} catch {
  // no-op
}
