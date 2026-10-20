import { apiSuccess } from "@/lib/api/response";
import { getMobileSiteContent } from "@/lib/mobile/site-content";

/**
 * Public website copy for the mobile app (About, Offers, FAQ, Blog, Terms,
 * Privacy, Contact, testimonials…). Unauthenticated so the info pages are
 * reachable from the app's sign-in screen too.
 */
export async function GET(): Promise<Response> {
  return apiSuccess(getMobileSiteContent());
}
