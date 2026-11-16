// SPDX-License-Identifier: AGPL-3.0-or-later

import { BarChart3, ArrowDownUp, Wallet, Upload, Home, Briefcase, Receipt, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'Visão Geral', icon: Home, path: '/' },
  { title: 'Posição', icon: Briefcase, path: '/posicao' },
  { title: 'Negociações', icon: ArrowDownUp, path: '/negociacoes' },
  { title: 'Proventos', icon: Wallet, path: '/proventos' },
  { title: 'Imposto de Renda', icon: Receipt, path: '/imposto-renda' },
];

const footerItems = [
  { title: 'Importar Dados', icon: Upload, path: '/importar' },
  { title: 'Configurações', icon: Settings, path: '/configuracoes' },
];

function NavItems({ items }: { items: typeof mainItems }) {
  const location = useLocation();
  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => (
        <SidebarMenuItem key={item.path}>
          <SidebarMenuButton asChild isActive={location.pathname === item.path} className="h-10 px-3 font-medium data-[active=true]:font-semibold">
            <Link to={item.path}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-sidebar-primary">
            <BarChart3 className="size-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight text-foreground">Portfólio</span>
            <span className="text-xs text-muted-foreground">Carteira na B3</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupContent>
            <NavItems items={mainItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <NavItems items={footerItems} />
      </SidebarFooter>
    </Sidebar>
  );
}
