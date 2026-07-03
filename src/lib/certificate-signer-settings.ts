import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, queryRows } from "@/lib/db";

export type CertificateSignerKey = "academic" | "registrar" | "director";

export interface CertificateSignerSetting {
  key: CertificateSignerKey;
  name: string;
  position: string;
  signatureUrl: string | null;
}

export type CertificateSignerSettings = Record<CertificateSignerKey, CertificateSignerSetting>;

const signerKeys = ["academic", "registrar", "director"] as const;

export const defaultCertificateSignerSettings: CertificateSignerSettings = {
  academic: {
    key: "academic",
    name: "",
    position: "รองผู้อำนวยการฝ่ายวิชาการ",
    signatureUrl: null,
  },
  registrar: {
    key: "registrar",
    name: "",
    position: "นายทะเบียน",
    signatureUrl: null,
  },
  director: {
    key: "director",
    name: "",
    position: "ผู้อำนวยการ",
    signatureUrl: null,
  },
};

const settingKey = {
  academic: {
    name: "certificate.signers.academic.name",
    position: "certificate.signers.academic.position",
    signatureUrl: "certificate.signers.academic.signature_url",
  },
  registrar: {
    name: "certificate.signers.registrar.name",
    position: "certificate.signers.registrar.position",
    signatureUrl: "certificate.signers.registrar.signature_url",
  },
  director: {
    name: "certificate.signers.director.name",
    position: "certificate.signers.director.position",
    signatureUrl: "certificate.signers.director.signature_url",
  },
} as const;

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function emptyToNull(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

export function getCertificateSignerSetting(
  settings: CertificateSignerSettings,
  key: CertificateSignerKey,
) {
  return settings[key] ?? defaultCertificateSignerSettings[key];
}

export async function getCertificateSignerSettings(): Promise<CertificateSignerSettings> {
  const keys = signerKeys.flatMap((key) => [
    settingKey[key].name,
    settingKey[key].position,
    settingKey[key].signatureUrl,
  ]);

  const [rows, templateRows] = await Promise.all([
    queryRows<RowDataPacket & { setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value
       FROM site_settings
       WHERE setting_key IN (${keys.map(() => "?").join(",")})`,
      keys,
    ).catch(() => []),
    queryRows<
      RowDataPacket & {
        signer_name: string | null;
        signer_position: string | null;
        signature_url: string | null;
      }
    >(
      `SELECT signer_name, signer_position, signature_url
       FROM certificate_templates
       WHERE status <> 'archived'
       ORDER BY is_default DESC, FIELD(status, 'active', 'draft'), id DESC
       LIMIT 1`,
    ).catch(() => []),
  ]);

  const valueMap = new Map(rows.map((row) => [row.setting_key, row.setting_value ?? ""]));
  const template = templateRows[0];
  const defaultsByKey: CertificateSignerSettings = {
    ...defaultCertificateSignerSettings,
    director: {
      ...defaultCertificateSignerSettings.director,
      name: normalizeText(template?.signer_name ?? defaultCertificateSignerSettings.director.name),
      position:
        normalizeText(template?.signer_position ?? defaultCertificateSignerSettings.director.position) ||
        defaultCertificateSignerSettings.director.position,
      signatureUrl: emptyToNull(template?.signature_url ?? defaultCertificateSignerSettings.director.signatureUrl),
    },
  };

  return signerKeys.reduce((settings, key) => {
    const defaults = defaultsByKey[key];
    settings[key] = {
      key,
      name: normalizeText(valueMap.get(settingKey[key].name) ?? defaults.name),
      position: normalizeText(valueMap.get(settingKey[key].position) ?? defaults.position) || defaults.position,
      signatureUrl: emptyToNull(valueMap.get(settingKey[key].signatureUrl) ?? defaults.signatureUrl),
    };
    return settings;
  }, {} as CertificateSignerSettings);
}

export async function saveCertificateSignerSettings(input: {
  userId: number;
  signers: CertificateSignerSettings;
}) {
  for (const key of signerKeys) {
    const signer = input.signers[key];
    const rows = [
      [settingKey[key].name, signer.name],
      [settingKey[key].position, signer.position],
      [settingKey[key].signatureUrl, signer.signatureUrl ?? ""],
    ] as const;

    for (const [settingName, value] of rows) {
      await executeQuery<ResultSetHeader>(
        `INSERT INTO site_settings (setting_key, setting_value, value_type, updated_by)
         VALUES (?, ?, 'text', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [settingName, value, input.userId],
      );
    }
  }
}
