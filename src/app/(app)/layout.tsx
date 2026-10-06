import { Shell } from "@/components/Shell";
import { VendorProvider } from "@/components/Vendor";

// Signed-in Buddy screens. v3: everyone lands on Home, verified or not.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorProvider>
      <Shell>{children}</Shell>
    </VendorProvider>
  );
}
