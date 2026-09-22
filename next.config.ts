import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Mongoose pulls in the real `mongodb` driver, which itself requires
  // Node's native `tls`/`net`/`dns` modules (see mongodb/lib/cmap/connect.js).
  // Without this, Next's build bundler tries to trace and bundle mongoose
  // like ordinary application code instead of just require()-ing it at
  // runtime, and chokes trying to resolve those Node built-ins — the
  // "Module not found: Can't resolve 'tls'" error. Marking it external
  // tells Next to leave it alone and let Node's own module resolution
  // handle it server-side, which is where every mongoose call in this app
  // already runs.
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
