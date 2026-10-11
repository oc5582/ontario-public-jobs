import { ViewerHeader } from "@/components/ViewerHeader";

export const dynamic = "force-dynamic";

export default async function MatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewerHeader />
      {children}
    </>
  );
}
