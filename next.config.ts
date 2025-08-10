import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    assetPrefix: '/ssm',
    basePath: '/ssm',
    allowedDevOrigins: ["sora2.uclab.jp"],

    env: {
      NEXT_PUBLIC_BASE_PATH: '/ssm',
    },
};

export default nextConfig;
