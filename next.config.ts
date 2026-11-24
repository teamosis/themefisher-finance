import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/invoice-tools/create-invoice",
        destination: "/create-invoice",
        permanent: true,
      },
      {
        source: "/invoice-tools/clients",
        destination: "/clients",
        permanent: true,
      },
      {
        source: "/scb-tools/payment-requests",
        destination: "/payment-requests",
        permanent: true,
      },
      {
        source: "/scb-tools/vendors",
        destination: "/vendors",
        permanent: true,
      },
      {
        source: "/scb-tools/debit-accounts",
        destination: "/debit-accounts",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
