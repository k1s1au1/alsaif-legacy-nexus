import { createFileRoute } from "@tanstack/react-router";
import FamilyOccasionsPage from "@/pages/family-occasions-page";

export const Route = createFileRoute("/_authenticated/family-occasions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مناسبات العائلة — السيف" },
      { name: "description", content: "إنشاء وإدارة مناسبات ودعوات العائلة." },
    ],
  }),
  component: FamilyOccasionsPage,
});
