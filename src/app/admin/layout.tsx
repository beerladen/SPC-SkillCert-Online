import { requireCurrentUser } from "@/lib/auth";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUser(["admin", "staff", "instructor"]);
  return children;
}
