const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist includes a Node.js canvas fallback that breaks the browser build
    config.resolve.alias.canvas = false;
    return config;
  }
};

export default nextConfig;
