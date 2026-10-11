import { ViewerHeader } from "@/components/ViewerHeader";

export const dynamic = "force-dynamic";

export default async function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/pages.css" />
      <ViewerHeader />
      {children}
    </>
  );
}
