/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Polling avoids EBUSY/file-lock issues on Windows/OneDrive.
      // Ignore protected Windows root paths so Watchpack does not lstat swapfile.sys / System Volume Information (EINVAL).
      // `ignored` must be only non-empty strings (Next/Webpack schema does not allow RegExp inside the array).
      config.watchOptions = {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/System Volume Information/**",
          "**/swapfile.sys",
          "**/pagefile.sys",
          "**/hiberfil.sys",
          "C:/System Volume Information/**",
          "C:\\System Volume Information/**",
          "C:/swapfile.sys",
          "C:\\swapfile.sys",
          "C:/pagefile.sys",
          "C:\\pagefile.sys",
          "C:/hiberfil.sys",
          "C:\\hiberfil.sys",
        ],
        poll: 1000,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
