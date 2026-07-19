import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SavedUpload {
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  size: number;
}

export type UploadFileEntry = File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

export const paymentEvidenceUploadPolicy = {
  maxBytes: 8 * 1024 * 1024,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
};

export const learningSubmissionUploadPolicy = {
  maxBytes: 30 * 1024 * 1024,
  allowedExtensions: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".rar",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ],
};

export const certificateAssetUploadPolicy = {
  maxBytes: 12 * 1024 * 1024,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
};

function sanitizeSegment(value: string, fallback = "upload") {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\u0E00-\u0E7F-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || fallback
  );
}

function safeFileName(value: string, fallback = "upload") {
  const parsed = path.parse(value || fallback);
  const name = sanitizeSegment(parsed.name, fallback);
  return `${name}${parsed.ext.toLowerCase()}`;
}

export function isUploadFileEntry(fileEntry: FormDataEntryValue | null): fileEntry is UploadFileEntry {
  if (!fileEntry || typeof fileEntry !== "object") {
    return false;
  }

  const candidate = fileEntry as Partial<UploadFileEntry>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    candidate.size > 0
  );
}

export function validateUploadFile(
  fileEntry: FormDataEntryValue | null,
  options: {
    required?: boolean;
    maxBytes: number;
    allowedExtensions: string[];
    label: string;
  },
) {
  if (!isUploadFileEntry(fileEntry)) {
    if (options.required) throw new Error(`กรุณาแนบ${options.label}`);
    return null;
  }

  if (fileEntry.size > options.maxBytes) {
    const maxMb = Math.floor(options.maxBytes / (1024 * 1024));
    throw new Error(`${options.label}ต้องมีขนาดไม่เกิน ${maxMb} MB`);
  }

  const extension = path.extname(fileEntry.name || "").toLowerCase();
  if (!options.allowedExtensions.includes(extension)) {
    throw new Error(
      `${options.label}รองรับเฉพาะไฟล์ ${options.allowedExtensions.join(", ")}`,
    );
  }

  return fileEntry;
}

export async function saveValidatedUpload(
  fileEntry: FormDataEntryValue | null,
  options: {
    rootFolder: string;
    publicBasePath: string;
    ownerSegment: string | number;
    fallbackName: string;
    maxBytes: number;
    allowedExtensions: string[];
    label: string;
    required?: boolean;
  },
): Promise<SavedUpload | null> {
  const file = validateUploadFile(fileEntry, options);
  if (!file) return null;

  const ownerSegment = sanitizeSegment(String(options.ownerSegment), "item");
  const directory = path.join(process.cwd(), "public", "uploads", options.rootFolder, ownerSegment);
  await mkdir(directory, { recursive: true });

  const storedFileName = `${Date.now()}-${safeFileName(file.name, options.fallbackName)}`;
  await writeFile(path.join(directory, storedFileName), Buffer.from(await file.arrayBuffer()));

  return {
    fileName: file.name,
    fileUrl: `${options.publicBasePath}/${ownerSegment}/${storedFileName}`,
    mimeType: file.type || null,
    size: file.size,
  };
}

export function resolvePublicUploadPath(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;

  const normalizedUrl = fileUrl.split(/[?#]/)[0];
  if (!normalizedUrl.startsWith("/uploads/")) return null;

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(normalizedUrl);
  } catch {
    decodedUrl = normalizedUrl;
  }

  const relativePath = decodedUrl.replace(/^\/uploads\//, "");
  if (!relativePath || relativePath.includes("\0")) return null;

  const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
  const targetPath = path.resolve(uploadRoot, relativePath);
  if (targetPath === uploadRoot || !targetPath.startsWith(`${uploadRoot}${path.sep}`)) {
    return null;
  }

  return targetPath;
}

export async function deletePublicUploadFiles(fileUrls: Iterable<string | null | undefined>) {
  const filePaths = new Set<string>();
  for (const fileUrl of fileUrls) {
    const filePath = resolvePublicUploadPath(fileUrl);
    if (filePath) filePaths.add(filePath);
  }

  const deleted: string[] = [];
  for (const filePath of filePaths) {
    try {
      await unlink(filePath);
      deleted.push(filePath);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return deleted;
}
