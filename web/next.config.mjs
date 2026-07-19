// The engine packages are TypeScript workspaces, so Next must transpile them.
// Their internal imports use explicit `.js` extensions (NodeNext style); the
// webpack `extensionAlias` maps those back to the real `.ts` sources. Heavy
// server-only libs are kept external so they aren't bundled into the server.

const enginePackages = [
  "@resume-prep/schema",
  "@resume-prep/scoring",
  "@resume-prep/llm",
  "@resume-prep/documents",
  "@resume-prep/ingest",
  "@resume-prep/analysis",
  "@resume-prep/versioning",
  "@resume-prep/linkedin",
  "@resume-prep/workflow",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: enginePackages,
  experimental: {
    serverComponentsExternalPackages: ["unpdf", "mammoth", "pdf-lib", "docx"],
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
