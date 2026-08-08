import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Continuum — Medicine supply resilience",
  description:
    "Explore the hidden connections in a medicine supply network and model disruption impact in seconds.",
  applicationName: "Continuum",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to network explorer
        </a>
        {children}
      </body>
    </html>
  );
}
