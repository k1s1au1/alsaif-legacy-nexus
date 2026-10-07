import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getCurrentUser } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ديوان السيف — بوابة العائلة" },
      { name: "description", content: "بوابة ديوان السيف لأفراد العائلة والمجلس." },
      { property: "og:title", content: "ديوان السيف — بوابة العائلة" },
      { property: "og:description", content: "بوابة ديوان السيف لأفراد العائلة والمجلس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    getCurrentUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-gold-primary text-sm tracking-[0.3em] uppercase animate-pulse">
        السيف
      </div>
    </div>
  );
}
