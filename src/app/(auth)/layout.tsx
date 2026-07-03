import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/55 to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">
              SPC
            </span>
            <span className="font-bold">SPC SkillCert Online</span>
          </Link>
          <Link href="/courses" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ดูหลักสูตร
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[460px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
