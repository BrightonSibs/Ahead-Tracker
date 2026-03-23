const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
