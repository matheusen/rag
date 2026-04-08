"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, MessageSquare, BookOpen, Lightbulb } from "lucide-react";

const links = [
  { href: "/apresentacao", label: "Apresentação",         icon: Lightbulb },
  { href: "/explorer", label: "SQLAlchemy Explorer", icon: Database },
  { href: "/chat",     label: "Chat RAG",            icon: MessageSquare },
  { href: "/guide",    label: "Guia RAG",             icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] bg-gray-900 border-r border-gray-700 flex flex-col z-20">
      <div className="px-5 py-4 border-b border-gray-700">
        <span className="text-white font-bold text-lg tracking-tight">⚙ RAG Study</span>
        <p className="text-gray-400 text-xs mt-0.5">Entrevista Ready</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-gray-700 text-gray-500 text-xs">
        Ollama · pgvector · FastAPI
      </div>
    </aside>
  );
}
