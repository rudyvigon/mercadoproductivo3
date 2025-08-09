import {
  createServerComponentClient,
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Para Server Components
export function createClient() {
  return createServerComponentClient({ cookies });
}

// Para Route Handlers (app/**/route.ts)
export function createRouteClient() {
  return createRouteHandlerClient({ cookies });
}
