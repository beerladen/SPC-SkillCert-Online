import Link from "next/link";

export function AuthLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">
        SPC
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-bold">SPC SkillCert Online</span>
        <span className="text-xs text-muted-foreground">ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์</span>
      </span>
    </Link>
  );
}
