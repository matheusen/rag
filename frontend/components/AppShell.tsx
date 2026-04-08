"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const CHROMELESS_ROUTES = ["/apresentacao"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChromeless = CHROMELESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <>
      {!isChromeless && <Sidebar />}
      <main className={isChromeless ? "min-h-screen" : "ml-[220px] min-h-screen p-6"}>{children}</main>
    </>
  );
}