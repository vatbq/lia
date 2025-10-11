import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MicrophoneContextProvider } from "@/contexts/microphone-context";
import { OpenAIRealtimeProvider } from "@/contexts/openai-realtime-context";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LIA",
    template: "%s · LIA",
  },
  description: "LIA — Listen, Insight, Act. Un asistente cálido.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                <span className="font-bold text-lg">LIA</span>
              </Link>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      className={navigationMenuTriggerStyle()}
                      asChild
                    >
                      <Link href="/dashboard">Dashboard</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
            <Link href="/">
              <Button>New Call</Button>
            </Link>
          </div>
        </nav>
        <MicrophoneContextProvider>
          <OpenAIRealtimeProvider>{children}</OpenAIRealtimeProvider>
        </MicrophoneContextProvider>
      </body>
    </html>
  );
}
