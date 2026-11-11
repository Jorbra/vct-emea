import { PageSkeleton } from "../components/Round9.jsx";

// while a page is being made on the server: a page-shaped placeholder instead of nothing
export default function Loading() {
  return <PageSkeleton />;
}
