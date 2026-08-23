import { createFileRoute } from "@tanstack/react-router";
import FamilyOccasionsPage from "@/pages/family-occasions-page";

export const Route = createFileRoute("/_authenticated/family-occasions")({
  component: FamilyOccasionsPage,
});
