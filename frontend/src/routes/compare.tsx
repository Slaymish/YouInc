import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/compare")({
  head: () => staticPageHead("compare"),
  component: renderStaticPage("compare"),
});
