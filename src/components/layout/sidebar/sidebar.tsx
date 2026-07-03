"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sidebarData, bottomNavItems, type NavSection as NavSectionType } from "./sidebar-data";
import { NavSection } from "./nav-section";
import { NavItem } from "./nav-item";
import { Logo } from "./logo";

interface SidebarProps {
  className?: string;
}

interface SidebarCounts {
  pendingRegistrations: number;
  pendingPayments: number;
}

interface SidebarNavigationPayload {
  sections: NavSectionType[];
  bottomItems: NavSectionType["items"];
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  const [navigation, setNavigation] = useState<SidebarNavigationPayload | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch("/admin/sidebar-counts", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
      fetch("/admin/navigation/sidebar", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([countData, navigationData]: [SidebarCounts | null, SidebarNavigationPayload | null]) => {
        if (!mounted) return;
        if (countData) setCounts(countData);
        if (navigationData?.sections?.length) setNavigation(navigationData);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const baseSections = navigation?.sections?.length ? navigation.sections : sidebarData;
  const baseBottomItems = navigation?.bottomItems?.length ? navigation.bottomItems : bottomNavItems;

  const sections = useMemo<NavSectionType[]>(
    () =>
      baseSections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          if (!item.badgeKey || !counts) return item;

          const value = counts[item.badgeKey] ?? 0;
          return {
            ...item,
            badge: value > 0 ? String(value) : undefined,
          };
        }),
      })),
    [baseSections, counts],
  );

  const bottomItems = useMemo(
    () =>
      baseBottomItems.map((item) => {
        if (!item.badgeKey || !counts) return item;
        const value = counts[item.badgeKey] ?? 0;
        return {
          ...item,
          badge: value > 0 ? String(value) : undefined,
        };
      }),
    [baseBottomItems, counts],
  );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar transition-all duration-300 overflow-hidden",
        collapsed ? "w-13" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-14 shrink-0 items-center border-b",
        collapsed ? "justify-center px-2" : "justify-between px-6"
      )}>
        {!collapsed && <Logo collapsed={collapsed} />}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Navigation with Scroll */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn("py-4", collapsed ? "px-2" : "px-3")}>
          <div className="space-y-2">
            {sections.map((section, index) => (
              <NavSection 
                key={index} 
                section={section} 
                collapsed={collapsed}
              />
            ))}
          </div>
        
          {/* Bottom Navigation - inside scroll area */}
          <div className="mt-6 border-t pt-4">
            <nav className="space-y-1">
              {bottomItems.map((item) => (
                <NavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </nav>
          </div>
        </div>
      </div>
    </aside>
  );
}
