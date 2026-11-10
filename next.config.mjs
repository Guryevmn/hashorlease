/** @type {import('next').NextConfig} */
const nextConfig = {
  // Не дописывать автоматический блок в AGENTS.md проекта.
  agentRules: false, devIndicators: false,
  // Открытие dev-сайта с телефона по Wi-Fi.
  allowedDevOrigins: ["10.1.31.83", "*.local"],
};
export default nextConfig;
