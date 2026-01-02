import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Optional: recommended for Docker to avoid source map overhead
  productionBrowserSourceMaps: false,  
  /* config options here */
  pageExtensions: ['ts', 'tsx']
};

export default nextConfig;
