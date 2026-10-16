"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Onboarding, Vendor, VendorV2 } from "@/lib/types";

type Ctx = { vendor: (Vendor & VendorV2) | null; onboarding: Onboarding | null; reload: () => Promise<void> };
const VendorCtx = createContext<Ctx>({ vendor: null, onboarding: null, reload: async () => {} });
export const useVendor = () => useContext(VendorCtx);

// Loads the signed-in Buddy once, with where they are in onboarding. Every Buddy lands on Home, which walks them
// through "Get verified". There is no separate onboarding route any more.
export function VendorProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [vendor, setVendor] = useState<Ctx["vendor"]>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const reload = useCallback(async () => {
    const [p, o] = await Promise.all([
      api<Vendor & VendorV2>("vendor/auth/get-profile-details", { query: { type: 1 } }),
      api<Onboarding>("vendor/auth/onboarding"),
    ]);
    setVendor(p.data);
    setOnboarding(o.data);
  }, []);
  useEffect(() => { reload().catch(() => router.replace("/login")); }, [reload, router]);
  useEffect(() => {
    // Work screens open only after admin approval.
    if (vendor && vendor.verificationStatus !== 1 && /^\/(jobs|earnings|notifications)(\/|$)/.test(path)) router.replace("/");
  }, [vendor, router, path]);
  return <VendorCtx.Provider value={{ vendor, onboarding, reload }}>{children}</VendorCtx.Provider>;
}
