import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.production.local" });
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL!,
  },
});
