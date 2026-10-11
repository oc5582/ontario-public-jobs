import { SiteHeader } from "@/components/SiteHeader";

export const revalidate = 900;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader signedIn={false} />
      {children}
    </>
  );
}
