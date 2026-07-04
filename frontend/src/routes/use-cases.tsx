import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/use-cases")({
  head: () => staticPageHead("use-cases"),
  component: renderStaticPage("use-cases"),
});
