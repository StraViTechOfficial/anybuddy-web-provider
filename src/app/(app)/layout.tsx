import { Shell } from "@/components/Shell";
import { VendorProvider } from "@/components/Vendor";

// Signed-in, onboarded Buddy screens. Unfinished onboarding is sent to /onboarding.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorProvider needs="onboarded">
      <Shell>{children}</Shell>
    </VendorProvider>
  );
}
