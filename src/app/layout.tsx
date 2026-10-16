import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
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
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17181c" };

// Every page renders per request, so each one gets the fresh nonce the middleware puts in its Content Security Policy.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="en-US" className={text.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
