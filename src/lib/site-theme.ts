export const siteThemeModes = ["light", "dark"] as const;
export const siteThemePresets = ["teal", "blue", "sky", "purple", "slate"] as const;

export type SiteThemeMode = (typeof siteThemeModes)[number];
export type SiteThemePreset = (typeof siteThemePresets)[number];

export interface SiteThemeSettings {
  mode: SiteThemeMode;
  preset: SiteThemePreset;
}

export interface SiteThemePresetOption {
  value: SiteThemePreset;
  label: string;
  description: string;
  swatches: string[];
}

export const defaultSiteTheme: SiteThemeSettings = {
  mode: "light",
  preset: "blue",
};

export const siteThemePresetOptions: SiteThemePresetOption[] = [
  {
    value: "blue",
    label: "น้ำเงินเข้ม-ขาว",
    description: "คมชัด สุภาพ เหมาะกับเว็บสถานศึกษาและงานทางการ",
    swatches: ["#0f2f63", "#1d4ed8", "#eaf2ff", "#ffffff"],
  },
  {
    value: "sky",
    label: "ฟ้า-ขาว",
    description: "สว่าง โปร่ง อ่านง่าย เหมาะกับผู้เรียนทุกช่วงวัย",
    swatches: ["#0369a1", "#0ea5e9", "#e0f2fe", "#ffffff"],
  },
  {
    value: "purple",
    label: "ม่วง-ขาว",
    description: "ทันสมัย โดดเด่น เหมาะกับหลักสูตรดิจิทัลและงานสร้างสรรค์",
    swatches: ["#4c1d95", "#7c3aed", "#f3e8ff", "#ffffff"],
  },
  {
    value: "teal",
    label: "เขียวฟ้าเดิม",
    description: "โทนหลักของ SPC SkillCert ที่ใช้อยู่เดิม อ่านง่ายและเป็นมิตร",
    swatches: ["#0f766e", "#14b8a6", "#e0f7f6", "#ffffff"],
  },
  {
    value: "slate",
    label: "เทาเข้มมืออาชีพ",
    description: "เรียบ นิ่ง ให้ความรู้สึกระบบงานหลังบ้านที่จริงจัง",
    swatches: ["#0f172a", "#334155", "#e2e8f0", "#ffffff"],
  },
];

export function isSiteThemeMode(value: FormDataEntryValue | string | null): value is SiteThemeMode {
  return typeof value === "string" && siteThemeModes.includes(value as SiteThemeMode);
}

export function isSiteThemePreset(value: FormDataEntryValue | string | null): value is SiteThemePreset {
  return typeof value === "string" && siteThemePresets.includes(value as SiteThemePreset);
}

export function normalizeSiteTheme(input: { mode?: string | null; preset?: string | null }): SiteThemeSettings {
  const mode = input.mode ?? null;
  const preset = input.preset ?? null;

  return {
    mode: isSiteThemeMode(mode) ? mode : defaultSiteTheme.mode,
    preset: isSiteThemePreset(preset) ? preset : defaultSiteTheme.preset,
  };
}

export function getSiteThemeClassName(theme: SiteThemeSettings) {
  return [theme.mode === "dark" ? "dark" : "", `theme-${theme.preset}`].filter(Boolean).join(" ");
}
