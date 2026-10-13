import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FaithCenter } from "@/components/faith/faith-center";

export const Route = createFileRoute("/_authenticated/faith")({
  ssr: false,
  head: () => ({ meta: [{ title: "الصلاة ومصحفي — السيف" }, { name: "description", content: "مواقيت الصلاة ومصحفي من مشروع المصحف الإلكتروني بجامعة الملك سعود." }] }),
  validateSearch: (search: Record<string, unknown>): { view: "prayer" | "mushaf" } => ({ view: search.view === "prayer" ? "prayer" : "mushaf" }),
  component: FaithPage,
});
function FaithPage() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AppShell title="الصلاة ومصحفي" user={{ name: "", role: "", initial: "س" }}><FaithCenter view={view} onViewChange={(value) => { void navigate({ search: { view: value }, replace: true }); }} /></AppShell>;
}
