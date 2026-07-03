import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Noto_Sans_Thai } from "next/font/google";
import { getSafeSiteThemeSettings } from "@/lib/site-theme-repositories";
import { getSiteThemeClassName } from "@/lib/site-theme";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SPC SkillCert Online",
  description:
    "ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ ระบบลงทะเบียน เรียนออนไลน์ วัดผล และออกใบประกาศนียบัตร",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  noStore();
  const theme = await getSafeSiteThemeSettings();

  return (
    <html lang="th" className={getSiteThemeClassName(theme)}>
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
