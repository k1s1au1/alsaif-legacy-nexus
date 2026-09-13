import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep old bookmarks valid without showing the retired mandatory profile form.
// The authenticated parent still verifies sign-in before this redirect runs.
export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: () => null,
});
