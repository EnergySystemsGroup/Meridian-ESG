/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better performance
  reactStrictMode: true,

  // Enable experimental optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

export default nextConfig;
