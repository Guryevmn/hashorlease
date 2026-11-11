/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not append the automatic block to the project's AGENTS.md.
  agentRules: false, devIndicators: false,
  // Open the dev site from a phone over Wi-Fi.
  allowedDevOrigins: ["10.1.31.83", "*.local"],
};
export default nextConfig;
