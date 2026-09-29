import { VendorProvider } from "@/components/Vendor";

// Onboarding has no tabs: one step at a time. The onboarding agent owns this folder's screens.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <VendorProvider needs="onboarding">{children}</VendorProvider>;
}
