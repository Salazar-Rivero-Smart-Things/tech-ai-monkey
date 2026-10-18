export const siteConfig = {
  name: "Tech AI monkey",
  version: "1.1.6",
  tagline: "A fair-priced AI that keeps learning.",
  modelName: process.env.MODEL_NAME ?? "Monkey Argon",
  modelVersion: process.env.MODEL_VERSION ?? "v1.1.6",
  companyName: process.env.COMPANY_NAME ?? "Salazar Rivero Smart Things",
  organizationNumber: process.env.ORGANIZATION_NUMBER ?? "933 853 195",
  taxCountry: "Norway",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@tech-ai.tech",
  supportWhatsAppUrl: process.env.SUPPORT_WHATSAPP_URL ?? "https://wa.me/4748904267",
  supportHours: process.env.SUPPORT_HOURS ?? "12:00–21:00 every day",
};
