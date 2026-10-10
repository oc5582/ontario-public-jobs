export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/pages.css" />
      {children}
    </>
  );
}
