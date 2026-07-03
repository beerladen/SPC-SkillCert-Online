"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden">
          <Header title={title} />
        </div>
        <main className="min-w-0 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
