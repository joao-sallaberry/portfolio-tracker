// SPDX-License-Identifier: AGPL-3.0-or-later

import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* On a phone the sidebar is a drawer; on larger screens it stays open */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <span className="font-display font-bold tracking-tight">Portfólio</span>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
