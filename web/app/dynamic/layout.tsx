import { ViewerHeader } from "@/components/ViewerHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewerHeader />
      {children}
    </>
  );
}
