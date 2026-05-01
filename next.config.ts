import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/pengaturan",
        destination: "/admin/settings",
        permanent: true,
      },
      {
        source: "/admin/pengaturan/:path*",
        destination: "/admin/settings/:path*",
        permanent: true,
      },
      {
        source: "/admin/anggota",
        destination: "/admin/members",
        permanent: true,
      },
      {
        source: "/admin/anggota/:path*",
        destination: "/admin/members/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.private.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
