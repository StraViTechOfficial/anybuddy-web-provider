"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Vendor } from "@/lib/types";

type Ctx = { vendor: Vendor | null; reload: () => Promise<void> };
const VendorCtx = createContext<Ctx>({ vendor: null, reload: async () => {} });
export const useVendor = () => useContext(VendorCtx);

// Loads the signed-in Buddy once. `needs` decides where an unfinished or finished Buddy belongs.
export function VendorProvider({ children, needs }: { children: ReactNode; needs: "onboarded" | "onboarding" }) {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const reload = useCallback(async () => {
    const { data } = await api<Vendor>("vendor/auth/get-profile-details", { query: { type: 1 } });
    setVendor(data);
  }, []);
  useEffect(() => { reload().catch(() => router.replace("/login")); }, [reload, router]);
  useEffect(() => {
    if (!vendor) return;
    if (needs === "onboarded" && vendor.step < 5) router.replace("/onboarding");
    if (needs === "onboarding" && vendor.step >= 5) router.replace("/");
  }, [vendor, needs, router]);
  return <VendorCtx.Provider value={{ vendor, reload }}>{children}</VendorCtx.Provider>;
}
