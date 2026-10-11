import { getViewer } from "@/lib/auth";
import { SiteHeader } from "./SiteHeader";

/** Signed-in header. Calling this opts the route out of the public cache. */
export async function ViewerHeader() {
  const viewer = await getViewer();
  return <SiteHeader signedIn={Boolean(viewer.email)} />;
}
