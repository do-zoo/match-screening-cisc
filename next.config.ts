import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/admin/pengaturan',
        destination: '/admin/settings',
        permanent: true,
      },
      {
        source: '/admin/pengaturan/:path*',
        destination: '/admin/settings/:path*',
        permanent: true,
      },
      {
        source: '/admin/anggota',
        destination: '/admin/members',
        permanent: true,
      },
      {
        source: '/admin/anggota/:path*',
        destination: '/admin/members/:path*',
        permanent: true,
      },
      {
        source: '/admin/events/:eventId/inbox',
        destination: '/admin/events/:eventId/registrants',
        permanent: true,
      },
      {
        source: '/admin/events/:eventId/inbox/:registrationId',
        destination: '/admin/events/:eventId/registrants/:registrationId',
        permanent: true,
      },
      {
        source: '/admin/settings/whatsapp-templates',
        destination: '/admin/settings/templates?tab=wa',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.private.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
