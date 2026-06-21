import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/assets/run-background.png',
        destination: '/assets/run-background.jpg',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
