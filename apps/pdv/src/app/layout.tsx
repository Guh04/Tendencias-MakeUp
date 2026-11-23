import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { FeedbackProvider } from "@tendencias/ui/feedback";
import { AuthProvider } from "@/hooks/useAuth";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PDV · Tendencias MakeUp",
  description: "Ponto de venda da Tendencias MakeUp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} antialiased`}>
      <body>
        <FeedbackProvider>
          <AuthProvider>{children}</AuthProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
