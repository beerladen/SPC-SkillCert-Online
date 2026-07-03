import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";
import { defaultSiteTheme, normalizeSiteTheme, type SiteThemeSettings } from "@/lib/site-theme";

const themeSettingKeys = {
  mode: "theme.mode",
  preset: "theme.preset",
} as const;

export async function getSiteThemeSettings(): Promise<SiteThemeSettings> {
  const rows = await queryRows<RowDataPacket & { setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value
     FROM site_settings
     WHERE setting_key IN (?, ?)`,
    [themeSettingKeys.mode, themeSettingKeys.preset],
  );

  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return normalizeSiteTheme({
    mode: map.get(themeSettingKeys.mode) ?? defaultSiteTheme.mode,
    preset: map.get(themeSettingKeys.preset) ?? defaultSiteTheme.preset,
  });
}

export async function getSafeSiteThemeSettings(): Promise<SiteThemeSettings> {
  try {
    return await getSiteThemeSettings();
  } catch {
    return defaultSiteTheme;
  }
}

export async function saveSiteThemeSettings(input: SiteThemeSettings & { userId: number }) {
  const settings = [
    [themeSettingKeys.mode, input.mode],
    [themeSettingKeys.preset, input.preset],
  ] as const;

  for (const [key, value] of settings) {
    await executeQuery<ResultSetHeader>(
      `INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by)
       VALUES (?, ?, 'text', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, input.userId],
    );
  }
}
