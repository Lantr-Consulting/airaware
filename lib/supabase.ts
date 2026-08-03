import { createClient } from "@supabase/supabase-js";
import { cookieStorage, onLantrSite } from "./cookie-storage";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  onLantrSite
    ? { auth: { storage: cookieStorage, storageKey: "lantr-auth" } }
    : undefined
);
