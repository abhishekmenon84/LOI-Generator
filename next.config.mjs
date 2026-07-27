/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next's client-side Router Cache otherwise keeps a dynamic page's RSC
  // payload for 30s on <Link>/back-forward navigation -- structural changes
  // made elsewhere (unnesting a folder, archiving, etc.) wouldn't show up
  // until that window expired or a hard reload. Forces every navigation to
  // a dynamic route to re-fetch from the server.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
