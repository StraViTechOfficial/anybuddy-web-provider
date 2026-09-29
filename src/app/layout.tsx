import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const text = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Any-Buddy Pro", template: "%s · Any-Buddy Pro" },
  description: "Run your Any-Buddy jobs, hours and earnings.",
  icons: { icon: "/mark.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#24345f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={text.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
