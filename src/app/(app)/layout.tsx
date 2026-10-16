import { Shell } from "@/components/Shell";
import { VendorProvider } from "@/components/Vendor";

// Screens for a signed-in Buddy. Everyone lands on Home, whether they are verified or not.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorProvider>
      <Shell>{children}</Shell>
    </VendorProvider>
  );
}
