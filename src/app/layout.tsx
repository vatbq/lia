import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MicrophoneContextProvider } from "@/contexts/microphone-context";
import { OpenAIRealtimeProvider } from "@/contexts/openai-realtime-context";

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
        <MicrophoneContextProvider>
          <OpenAIRealtimeProvider>{children}</OpenAIRealtimeProvider>
        </MicrophoneContextProvider>
      </body>
    </html>
  );
}
