const isWin = process.platform === "win32";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      /*
       * Windows + OneDrive/Desktop sync: webpack’s filesystem cache under `.next/cache`
       * often hits EBUSY / ENOENT (locks, rename races). Memory cache avoids that.
       * Opt back in with NEXT_WEBPACK_FS_CACHE=1 if the project is on a normal local disk.
       */
      if (isWin && process.env.NEXT_WEBPACK_FS_CACHE !== "1") {
        config.cache = { type: "memory" };
      }

      if (isWin) {
        config.resolve.symlinks = false;
      }

      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.cursor/**",
        ],
        poll: parseInt(process.env.NEXT_WEBPACK_POLL_MS ?? "1000", 10) || 1000,
        aggregateTimeout: 500,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
