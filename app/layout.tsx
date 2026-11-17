import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display-src", weight: ["600", "700", "800"] });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans-src" });

export const metadata: Metadata = {
  title: "Squeeze: free image compressor and resizer",
  description: "Make JPG, PNG and WebP images smaller in your browser. Free, fast and private. Nothing is uploaded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
