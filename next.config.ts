import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
   assetPrefix: '/ssm',
   basePath: '/ssm',
   env: {
     NEXT_PUBLIC_BASE_PATH: '/ssm',
   },
};

export default nextConfig;
