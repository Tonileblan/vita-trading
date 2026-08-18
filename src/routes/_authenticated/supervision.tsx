import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/supervision")({
  beforeLoad: () => {
    throw redirect({ to: "/panel" });
  },
  component: () => null,
});
