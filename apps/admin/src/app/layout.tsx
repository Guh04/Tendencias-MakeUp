import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { FeedbackProvider } from "@/hooks/useFeedback";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/hooks/useAuth";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Administração · Tendencias MakeUp",
  description: "Administração da Tendencias MakeUp: produtos, vendas, clientes, financeiro e relatórios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable} antialiased`}>
      <body>
        <FeedbackProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
