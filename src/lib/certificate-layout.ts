export type CertificateLayoutDocumentType = "certificate" | "honor_certificate";

export type CertificateTextElementKey =
  | "certificateNo"
  | "issuerName"
  | "documentTitle"
  | "preface"
  | "learnerName"
  | "completionText"
  | "courseTitle"
  | "issuedAt"
  | "blessing";

export type CertificateObjectElementKey =
  | "registrarSigner"
  | "directorSigner"
  | "singleSigner"
  | "qrCode";

export type CertificateTextAlign = "left" | "center" | "right";
export type CertificateFontFamily = "noto" | "sarabun" | "sans" | "serif";
export type CertificateFontWeight = "400" | "500" | "600" | "700" | "800";

export interface CertificateFixedTextSet {
  certificateNoPrefix: string;
  documentTitle: string;
  preface: string;
  completionText: string;
  issuedAtPrefix: string;
  blessing: string;
}

export interface CertificateTextElementLayout {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: CertificateFontFamily;
  fontWeight: CertificateFontWeight;
  align: CertificateTextAlign;
  color: string;
  lineHeight: number;
}

export interface CertificateObjectElementLayout {
  x: number;
  y: number;
  width: number;
  align: CertificateTextAlign;
  color: string;
  signatureHeight: number;
  lineWidth: number;
  nameFontSize: number;
  positionFontSize: number;
  qrSize: number;
  labelFontSize: number;
}

export interface CertificateTemplateLayoutConfig {
  version: 2;
  documents: Record<CertificateLayoutDocumentType, CertificateFixedTextSet>;
  elements: Record<CertificateTextElementKey, CertificateTextElementLayout>;
  objects: Record<CertificateLayoutDocumentType, Record<CertificateObjectElementKey, CertificateObjectElementLayout>>;
}

export interface CertificatePreviewValues {
  certificateNo: string;
  issuerName: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
}

export interface CertificateTextElementDefinition {
  key: CertificateTextElementKey;
  label: string;
  source: "dynamic" | "fixed" | "prefix";
  fixedTextKey?: keyof CertificateFixedTextSet;
}

export interface CertificateObjectElementDefinition {
  key: CertificateObjectElementKey;
  label: string;
  kind: "signature" | "qr";
  documentTypes: CertificateLayoutDocumentType[];
}

export const certificateFontOptions: Array<{
  value: CertificateFontFamily;
  label: string;
  css: string;
}> = [
  {
    value: "noto",
    label: "Noto Sans Thai",
    css: "var(--font-noto-sans-thai), 'Noto Sans Thai', 'Sarabun', 'Tahoma', system-ui, sans-serif",
  },
  {
    value: "sarabun",
    label: "Sarabun",
    css: "'Sarabun', var(--font-noto-sans-thai), 'Noto Sans Thai', 'Tahoma', system-ui, sans-serif",
  },
  {
    value: "sans",
    label: "Sans",
    css: "system-ui, 'Noto Sans Thai', 'Sarabun', 'Tahoma', sans-serif",
  },
  {
    value: "serif",
    label: "Serif",
    css: "'TH Sarabun New', 'Sarabun', 'Noto Serif Thai', serif",
  },
];

export const certificateTextElementDefinitions: CertificateTextElementDefinition[] = [
  { key: "certificateNo", label: "เลขที่", source: "prefix", fixedTextKey: "certificateNoPrefix" },
  { key: "issuerName", label: "ชื่อหน่วยงาน", source: "dynamic" },
  { key: "documentTitle", label: "ชื่อเอกสาร", source: "fixed", fixedTextKey: "documentTitle" },
  { key: "preface", label: "ข้อความรับรอง", source: "fixed", fixedTextKey: "preface" },
  { key: "learnerName", label: "ชื่อผู้เรียน", source: "dynamic" },
  { key: "completionText", label: "ข้อความผลการเรียน", source: "fixed", fixedTextKey: "completionText" },
  { key: "courseTitle", label: "ชื่อหลักสูตร", source: "dynamic" },
  { key: "issuedAt", label: "วันที่ออก", source: "prefix", fixedTextKey: "issuedAtPrefix" },
  { key: "blessing", label: "คำอวยพร", source: "fixed", fixedTextKey: "blessing" },
];

export const certificateObjectElementDefinitions: CertificateObjectElementDefinition[] = [
  {
    key: "registrarSigner",
    label: "ผู้ลงนามซ้าย / นายทะเบียน",
    kind: "signature",
    documentTypes: ["certificate"],
  },
  {
    key: "directorSigner",
    label: "ผู้ลงนามขวา / ผู้อำนวยการ",
    kind: "signature",
    documentTypes: ["certificate"],
  },
  {
    key: "singleSigner",
    label: "ผู้ลงนามกลาง",
    kind: "signature",
    documentTypes: ["honor_certificate"],
  },
  {
    key: "qrCode",
    label: "QR Code ตรวจสอบ",
    kind: "qr",
    documentTypes: ["certificate", "honor_certificate"],
  },
];

export const defaultCertificateFixedText: Record<CertificateLayoutDocumentType, CertificateFixedTextSet> = {
  certificate: {
    certificateNoPrefix: "เลขที่",
    documentTitle: "ประกาศนียบัตรวิชาชีพเฉพาะ",
    preface: "ฉบับนี้ให้ไว้เพื่อแสดงว่า",
    completionText: "สำเร็จการศึกษาหลักสูตรวิชา",
    issuedAtPrefix: "เมื่อวันที่",
    blessing: "ขอให้มีความสุขสวัสดีวัฒนา",
  },
  honor_certificate: {
    certificateNoPrefix: "เลขที่",
    documentTitle: "เกียรติบัตร",
    preface: "ฉบับนี้ให้ไว้เพื่อแสดงว่า",
    completionText: "ผ่านการอบรมหลักสูตร",
    issuedAtPrefix: "เมื่อวันที่",
    blessing: "ขอให้มีความสุขสวัสดีวัฒนา",
  },
};

const defaultObjectBase: CertificateObjectElementLayout = {
  x: 50,
  y: 74.5,
  width: 28,
  align: "left",
  color: "#061426",
  signatureHeight: 58,
  lineWidth: 74,
  nameFontSize: 17,
  positionFontSize: 16,
  qrSize: 78,
  labelFontSize: 12,
};

export const defaultCertificateObjectLayouts: CertificateTemplateLayoutConfig["objects"] = {
  certificate: {
    registrarSigner: {
      ...defaultObjectBase,
      x: 22,
      y: 74.5,
      width: 28,
      align: "left",
    },
    directorSigner: {
      ...defaultObjectBase,
      x: 58,
      y: 74.5,
      width: 28,
      align: "left",
    },
    singleSigner: {
      ...defaultObjectBase,
      x: 50,
      y: 74.5,
      width: 38,
      align: "center",
    },
    qrCode: {
      ...defaultObjectBase,
      x: 91.5,
      y: 80.5,
      width: 14,
      align: "right",
    },
  },
  honor_certificate: {
    registrarSigner: {
      ...defaultObjectBase,
      x: 22,
      y: 74.5,
      width: 28,
      align: "left",
    },
    directorSigner: {
      ...defaultObjectBase,
      x: 58,
      y: 74.5,
      width: 28,
      align: "left",
    },
    singleSigner: {
      ...defaultObjectBase,
      x: 50,
      y: 74.5,
      width: 38,
      align: "center",
    },
    qrCode: {
      ...defaultObjectBase,
      x: 91.5,
      y: 80.5,
      width: 14,
      align: "right",
    },
  },
};

export const defaultCertificateTemplateLayoutConfig: CertificateTemplateLayoutConfig = {
  version: 2,
  documents: defaultCertificateFixedText,
  elements: {
    certificateNo: {
      x: 91.5,
      y: 15,
      width: 32,
      fontSize: 18,
      fontFamily: "noto",
      fontWeight: "600",
      align: "right",
      color: "#0b1638",
      lineHeight: 1.18,
    },
    issuerName: {
      x: 50,
      y: 27.5,
      width: 68,
      fontSize: 38,
      fontFamily: "noto",
      fontWeight: "700",
      align: "center",
      color: "#0b1638",
      lineHeight: 1.15,
    },
    documentTitle: {
      x: 50,
      y: 35,
      width: 68,
      fontSize: 27,
      fontFamily: "noto",
      fontWeight: "600",
      align: "center",
      color: "#0b1638",
      lineHeight: 1.15,
    },
    preface: {
      x: 50,
      y: 40.2,
      width: 66,
      fontSize: 20,
      fontFamily: "noto",
      fontWeight: "500",
      align: "center",
      color: "#1f2a44",
      lineHeight: 1.2,
    },
    learnerName: {
      x: 50,
      y: 45.5,
      width: 72,
      fontSize: 45,
      fontFamily: "noto",
      fontWeight: "800",
      align: "center",
      color: "#0b1638",
      lineHeight: 1.16,
    },
    completionText: {
      x: 50,
      y: 58,
      width: 70,
      fontSize: 19,
      fontFamily: "noto",
      fontWeight: "500",
      align: "center",
      color: "#0b1638",
      lineHeight: 1.2,
    },
    courseTitle: {
      x: 50,
      y: 61.5,
      width: 70,
      fontSize: 22,
      fontFamily: "noto",
      fontWeight: "600",
      align: "center",
      color: "#0b1638",
      lineHeight: 1.25,
    },
    issuedAt: {
      x: 50,
      y: 68.2,
      width: 70,
      fontSize: 19,
      fontFamily: "noto",
      fontWeight: "500",
      align: "center",
      color: "#1f2a44",
      lineHeight: 1.2,
    },
    blessing: {
      x: 50,
      y: 73,
      width: 70,
      fontSize: 18,
      fontFamily: "noto",
      fontWeight: "500",
      align: "center",
      color: "#1f2a44",
      lineHeight: 1.2,
    },
  },
  objects: defaultCertificateObjectLayouts,
};

const fontFamilies = new Set<CertificateFontFamily>(certificateFontOptions.map((option) => option.value));
const fontWeights = new Set<CertificateFontWeight>(["400", "500", "600", "700", "800"]);
const textAligns = new Set<CertificateTextAlign>(["left", "center", "right"]);

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function normalizeText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 160) : fallback;
}

function normalizeFontFamily(value: unknown, fallback: CertificateFontFamily) {
  return fontFamilies.has(value as CertificateFontFamily) ? (value as CertificateFontFamily) : fallback;
}

function normalizeFontWeight(value: unknown, fallback: CertificateFontWeight) {
  return fontWeights.has(value as CertificateFontWeight) ? (value as CertificateFontWeight) : fallback;
}

function normalizeTextAlign(value: unknown, fallback: CertificateTextAlign) {
  return textAligns.has(value as CertificateTextAlign) ? (value as CertificateTextAlign) : fallback;
}

function parseRawConfig(raw: unknown): Partial<CertificateTemplateLayoutConfig> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Partial<CertificateTemplateLayoutConfig>;
  return {};
}

export function normalizeCertificateLayoutConfig(raw: unknown): CertificateTemplateLayoutConfig {
  const parsed = parseRawConfig(raw);
  const isCurrentVersion = parsed.version === 2;
  const rawDocuments = (isCurrentVersion ? (parsed.documents ?? {}) : {}) as Partial<
    Record<CertificateLayoutDocumentType, Partial<CertificateFixedTextSet>>
  >;
  const rawElements = (isCurrentVersion ? (parsed.elements ?? {}) : {}) as Partial<
    Record<CertificateTextElementKey, Partial<CertificateTextElementLayout>>
  >;
  const rawObjects = (isCurrentVersion ? (parsed.objects ?? {}) : {}) as Partial<
    Record<CertificateLayoutDocumentType, Partial<Record<CertificateObjectElementKey, Partial<CertificateObjectElementLayout>>>>
  >;

  const documents = (Object.keys(defaultCertificateFixedText) as CertificateLayoutDocumentType[]).reduce(
    (items, documentType) => {
      const defaults = defaultCertificateFixedText[documentType];
      const source = rawDocuments[documentType] ?? {};
      items[documentType] = {
        certificateNoPrefix: normalizeText(source.certificateNoPrefix, defaults.certificateNoPrefix),
        documentTitle: normalizeText(source.documentTitle, defaults.documentTitle),
        preface: normalizeText(source.preface, defaults.preface),
        completionText: normalizeText(source.completionText, defaults.completionText),
        issuedAtPrefix: normalizeText(source.issuedAtPrefix, defaults.issuedAtPrefix),
        blessing: normalizeText(source.blessing, defaults.blessing),
      };
      return items;
    },
    {} as Record<CertificateLayoutDocumentType, CertificateFixedTextSet>,
  );

  const elements = certificateTextElementDefinitions.reduce((items, definition) => {
    const defaults = defaultCertificateTemplateLayoutConfig.elements[definition.key];
    const source = rawElements?.[definition.key] ?? {};
    items[definition.key] = {
      x: clamp(source.x, 0, 100, defaults.x),
      y: clamp(source.y, 0, 100, defaults.y),
      width: clamp(source.width, 8, 100, defaults.width),
      fontSize: clamp(source.fontSize, 8, 72, defaults.fontSize),
      fontFamily: normalizeFontFamily(source.fontFamily, defaults.fontFamily),
      fontWeight: normalizeFontWeight(source.fontWeight, defaults.fontWeight),
      align: normalizeTextAlign(source.align, defaults.align),
      color: normalizeColor(source.color, defaults.color),
      lineHeight: clamp(source.lineHeight, 0.9, 2, defaults.lineHeight),
    };
    return items;
  }, {} as Record<CertificateTextElementKey, CertificateTextElementLayout>);

  const objects = (Object.keys(defaultCertificateObjectLayouts) as CertificateLayoutDocumentType[]).reduce(
    (documentItems, documentType) => {
      const defaults = defaultCertificateObjectLayouts[documentType];
      const sourceDocument = rawObjects[documentType] ?? {};
      documentItems[documentType] = (Object.keys(defaults) as CertificateObjectElementKey[]).reduce(
        (objectItems, key) => {
          const defaultObject = defaults[key];
          const source = sourceDocument[key] ?? {};
          objectItems[key] = {
            x: clamp(source.x, 0, 100, defaultObject.x),
            y: clamp(source.y, 0, 100, defaultObject.y),
            width: clamp(source.width, 6, 100, defaultObject.width),
            align: normalizeTextAlign(source.align, defaultObject.align),
            color: normalizeColor(source.color, defaultObject.color),
            signatureHeight: clamp(source.signatureHeight, 0, 140, defaultObject.signatureHeight),
            lineWidth: clamp(source.lineWidth, 10, 100, defaultObject.lineWidth),
            nameFontSize: clamp(source.nameFontSize, 8, 42, defaultObject.nameFontSize),
            positionFontSize: clamp(source.positionFontSize, 8, 36, defaultObject.positionFontSize),
            qrSize: clamp(source.qrSize, 40, 180, defaultObject.qrSize),
            labelFontSize: clamp(source.labelFontSize, 8, 24, defaultObject.labelFontSize),
          };
          return objectItems;
        },
        {} as Record<CertificateObjectElementKey, CertificateObjectElementLayout>,
      );
      return documentItems;
    },
    {} as Record<CertificateLayoutDocumentType, Record<CertificateObjectElementKey, CertificateObjectElementLayout>>,
  );

  return { version: 2, documents, elements, objects };
}

export function serializeCertificateLayoutConfig(raw: unknown) {
  return JSON.stringify(normalizeCertificateLayoutConfig(raw));
}

export function getCertificateFontFamilyCss(fontFamily: CertificateFontFamily) {
  return certificateFontOptions.find((option) => option.value === fontFamily)?.css ?? certificateFontOptions[0].css;
}

export function getCertificateTextElementText(
  key: CertificateTextElementKey,
  documentType: CertificateLayoutDocumentType,
  values: CertificatePreviewValues,
  layoutConfig: CertificateTemplateLayoutConfig,
) {
  const fixedText = layoutConfig.documents[documentType] ?? layoutConfig.documents.honor_certificate;

  switch (key) {
    case "certificateNo":
      return `${fixedText.certificateNoPrefix} ${values.certificateNo}`.trim();
    case "issuerName":
      return values.issuerName;
    case "documentTitle":
      return fixedText.documentTitle;
    case "preface":
      return fixedText.preface;
    case "learnerName":
      return values.learnerName;
    case "completionText":
      return fixedText.completionText;
    case "courseTitle":
      return values.courseTitle;
    case "issuedAt":
      return `${fixedText.issuedAtPrefix} ${values.issuedAt}`.trim();
    case "blessing":
      return fixedText.blessing;
    default:
      return "";
  }
}

export function getCertificateTextElementStyle(element: CertificateTextElementLayout) {
  const transform =
    element.align === "center" ? "translateX(-50%)" : element.align === "right" ? "translateX(-100%)" : undefined;

  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    transform,
    fontSize: `${element.fontSize}px`,
    fontFamily: getCertificateFontFamilyCss(element.fontFamily),
    fontWeight: element.fontWeight,
    textAlign: element.align,
    color: element.color,
    lineHeight: element.lineHeight,
  };
}

export function getCertificateObjectDefinitionsForDocument(documentType: CertificateLayoutDocumentType) {
  return certificateObjectElementDefinitions.filter((definition) => definition.documentTypes.includes(documentType));
}

export function getCertificateObjectElementStyle(element: CertificateObjectElementLayout) {
  const transform =
    element.align === "center" ? "translateX(-50%)" : element.align === "right" ? "translateX(-100%)" : undefined;

  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    transform,
    color: element.color,
  };
}
