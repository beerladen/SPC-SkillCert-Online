"use client"
import type { NavSection as NavSectionType } from "./sidebar-data"
import { NavItem } from "./nav-item"

interface NavSectionProps {
  section: NavSectionType
  collapsed?: boolean
}

export function NavSection({ section, collapsed }: NavSectionProps) {
  // ถ้าไม่มี title (เช่น Home) ให้แสดงเป็น nav items ปกติ
  if (!section.title) {
    return (
      <nav className="space-y-1">
        {section.items.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    );
  }

  // ถ้า collapsed ให้แสดงเฉพาะ icons
  if (collapsed) {
    return (
      <nav className="space-y-1">
        {section.items.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    );
  }

  return (
    <section className="space-y-1">
      <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
        {section.title}
      </div>
      <nav className="space-y-1">
        {section.items.map((item) => (
          <NavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </section>
  );
}
