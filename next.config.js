/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Disable webpack cache in dev to avoid corruption (e.g. OneDrive sync)
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
