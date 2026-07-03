"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { saveHomeHeroSettings, saveSiteSettings } from "@/lib/admin-summary-repositories";
import { saveDefaultCertificateTemplate } from "@/lib/certificate-repositories";
import {
  defaultCertificateSignerSettings,
  saveCertificateSignerSettings,
  type CertificateSignerKey,
  type CertificateSignerSettings,
} from "@/lib/certificate-signer-settings";
import { isSiteThemeMode, isSiteThemePreset } from "@/lib/site-theme";
import { getSiteThemeSettings, saveSiteThemeSettings } from "@/lib/site-theme-repositories";
import { certificateAssetUploadPolicy, saveValidatedUpload } from "@/lib/upload-security";

function text(formData: FormData, key: string, fallback = "") {
  const value = String(formData.get(key) ?? "").trim();
  return value || fallback;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function saveSiteSettingsAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  await saveSiteSettings({
    userId: user.id,
    name: text(formData, "name"),
    shortName: text(formData, "shortName"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    address: text(formData, "address"),
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?updated=site");
}

export async function saveHomeHeroSettingsAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const currentImageUrl = text(formData, "imageUrl", "/images/spc-hero-vocational-training.png");

  const heroUpload = await saveValidatedUpload(formData.get("heroImageFile"), {
    rootFolder: "site",
    publicBasePath: "/uploads/site",
    ownerSegment: "hero",
    fallbackName: "home-hero",
    label: "ภาพ Hero หน้าแรก",
    ...certificateAssetUploadPolicy,
  });

  await saveHomeHeroSettings({
    userId: user.id,
    enabled: formData.get("enabled") === "on",
    title: text(formData, "title", "ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์"),
    subtitle: text(formData, "subtitle", "SPC SkillCert Online"),
    description: text(
      formData,
      "description",
      "เรียนออนไลน์ ได้มาตรฐาน พัฒนาทักษะวิชาชีพ พร้อมวัดผลและออกใบประกาศนียบัตรที่ตรวจสอบได้",
    ),
    imageUrl: heroUpload?.fileUrl ?? currentImageUrl,
    primaryLabel: text(formData, "primaryLabel", "ดูหลักสูตรที่เปิดรับสมัคร"),
    primaryUrl: text(formData, "primaryUrl", "/courses"),
    secondaryLabel: text(formData, "secondaryLabel", "ตรวจสอบใบประกาศนียบัตร"),
    secondaryUrl: text(formData, "secondaryUrl", "/verify-certificate"),
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?updated=hero");
}

export async function saveThemeSettingsAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const currentTheme = await getSiteThemeSettings();
  const mode = formData.get("mode");
  const preset = formData.get("preset");

  await saveSiteThemeSettings({
    userId: user.id,
    mode: isSiteThemeMode(mode) ? mode : currentTheme.mode,
    preset: isSiteThemePreset(preset) ? preset : currentTheme.preset,
  });

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?updated=theme");
}

export async function saveCertificateTemplateAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const templateId = numberValue(formData, "templateId");
  const currentBackgroundUrl = text(formData, "backgroundUrl");
  const currentSignatureUrl = text(formData, "signatureUrl");

  const backgroundUpload = await saveValidatedUpload(formData.get("backgroundFile"), {
    rootFolder: "certificates",
    publicBasePath: "/uploads/certificates",
    ownerSegment: "templates",
    fallbackName: "certificate-template",
    label: "ภาพเทมเพลตใบประกาศ",
    ...certificateAssetUploadPolicy,
  });

  const signatureUpload = await saveValidatedUpload(formData.get("signatureFile"), {
    rootFolder: "certificates",
    publicBasePath: "/uploads/certificates",
    ownerSegment: "signatures",
    fallbackName: "director-signature",
    label: "ลายเซ็นต์ผู้อำนวยการ",
    ...certificateAssetUploadPolicy,
  });

  await saveDefaultCertificateTemplate({
    id: templateId,
    userId: user.id,
    name: text(formData, "templateName", "เทมเพลตใบประกาศลงนามผู้อำนวยการวิทยาลัย"),
    backgroundUrl: backgroundUpload?.fileUrl ?? currentBackgroundUrl,
    signatureUrl: signatureUpload?.fileUrl ?? currentSignatureUrl,
    issuerName: text(formData, "issuerName", "วิทยาลัยสารพัดช่างสุรินทร์"),
    signerName: text(formData, "signerName"),
    signerPosition: text(formData, "signerPosition", "ผู้อำนวยการวิทยาลัย"),
    status: "active",
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/certificates");
  revalidatePath("/certificates/[certificateNo]", "page");
  redirect("/admin/settings?updated=certificate");
}

const signerKeys = ["academic", "registrar", "director"] as const;
const signerUploadLabel: Record<CertificateSignerKey, string> = {
  academic: "ลายเซ็นต์รองผู้อำนวยการฝ่ายวิชาการ",
  registrar: "ลายเซ็นต์นายทะเบียน",
  director: "ลายเซ็นต์ผู้อำนวยการ",
};

export async function saveCertificateSignerSettingsAction(formData: FormData) {
  const user = await requireCurrentUser(["admin"]);
  const signers = {} as CertificateSignerSettings;

  for (const key of signerKeys) {
    const defaults = defaultCertificateSignerSettings[key];
    const currentSignatureUrl = text(formData, `${key}SignatureUrl`);
    const signatureUpload = await saveValidatedUpload(formData.get(`${key}SignatureFile`), {
      rootFolder: "certificates",
      publicBasePath: "/uploads/certificates",
      ownerSegment: "signatures",
      fallbackName: `${key}-signature`,
      label: signerUploadLabel[key],
      ...certificateAssetUploadPolicy,
    });

    signers[key] = {
      key,
      name: text(formData, `${key}Name`),
      position: text(formData, `${key}Position`, defaults.position),
      signatureUrl: signatureUpload?.fileUrl ?? currentSignatureUrl,
    };
  }

  await saveCertificateSignerSettings({
    userId: user.id,
    signers,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/certificates/reports/[id]", "page");
  revalidatePath("/certificate-approval/[token]", "page");
  redirect("/admin/settings?updated=certificate-signers");
}
