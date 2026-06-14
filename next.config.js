/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // better-sqlite3 and sharp are native modules; keep them external on the server
  serverExternalPackages: ['better-sqlite3', 'sharp'],
};

module.exports = nextConfig;
