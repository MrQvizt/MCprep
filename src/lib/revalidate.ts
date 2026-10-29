import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Public pages render dynamically, but browsers keep a client-side router
 * cache. Call after admin changes so visitors and the admin see fresh data.
 */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
}
