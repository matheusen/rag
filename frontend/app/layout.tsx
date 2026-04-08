import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "RAG Study — Entrevista Ready",
  description: "Estudo de RAG, LangChain, LlamaIndex, pgvector, SQLAlchemy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-950 text-gray-100 min-h-screen" suppressHydrationWarning>
        <Sidebar />
        <main className="ml-[220px] min-h-screen p-6">{children}</main>
      </body>
    </html>
  );
}
