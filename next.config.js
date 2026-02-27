/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Use polling to avoid EBUSY/file-lock issues on Windows/OneDrive
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
        poll: 1000,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
