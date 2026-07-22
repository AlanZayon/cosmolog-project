import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cosmolog - Plataforma de Histórias Multimídia",
  description:
    "Crie, leia e compartilhe contos, livros, quadrinhos e histórias ilustradas em universos conectados.",
  authors: [{ name: "Cosmolog" }],
  openGraph: {
    title: "Cosmolog - Histórias Multimídia",
    description:
      "Crie, leia e compartilhe contos, livros, quadrinhos e histórias ilustradas em universos conectados.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
  auth,
}: Readonly<{
  children: React.ReactNode;
  auth: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        <Providers>
          {children}
          {auth}
        </Providers>
      </body>
    </html>
  );
}
