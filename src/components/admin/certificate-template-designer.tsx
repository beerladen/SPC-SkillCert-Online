"use client";

import { Eye, Save, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  certificateFontOptions,
  getCertificateObjectDefinitionsForDocument,
  getCertificateObjectElementStyle,
  certificateTextElementDefinitions,
  defaultCertificateTemplateLayoutConfig,
  getCertificateTextElementStyle,
  getCertificateTextElementText,
  normalizeCertificateLayoutConfig,
  serializeCertificateLayoutConfig,
  type CertificateFixedTextSet,
  type CertificateFontFamily,
  type CertificateFontWeight,
  type CertificateLayoutDocumentType,
  type CertificateObjectElementKey,
  type CertificateObjectElementLayout,
  type CertificateTemplateLayoutConfig,
  type CertificateTextAlign,
  type CertificateTextElementKey,
  type CertificateTextElementLayout,
} from "@/lib/certificate-layout";
import type { CertificateTemplateSettings } from "@/lib/certificate-repositories";

const documentTypeOptions: Array<{ value: CertificateLayoutDocumentType; label: string }> = [
  { value: "certificate", label: "ใบประกาศนียบัตร" },
  { value: "honor_certificate", label: "เกียรติบัตร" },
];

const fontWeightOptions: Array<{ value: CertificateFontWeight; label: string }> = [
  { value: "400", label: "ปกติ" },
  { value: "500", label: "กลาง" },
  { value: "600", label: "กึ่งหนา" },
  { value: "700", label: "หนา" },
  { value: "800", label: "หนามาก" },
];

const textAlignOptions: Array<{ value: CertificateTextAlign; label: string }> = [
  { value: "left", label: "ซ้าย" },
  { value: "center", label: "กลาง" },
  { value: "right", label: "ขวา" },
];

const sampleValues = {
  certificateNo: "SPC-CERT-2569-00001",
  issuerName: "วิทยาลัยสารพัดช่างสุรินทร์",
  learnerName: "นายสมชาย ใจดี",
  courseTitle: "โปรแกรม Microsoft Word ในสำนักงาน",
  issuedAt: "3 กรกฎาคม 2569",
};

type DesignerSelection = `text:${CertificateTextElementKey}` | `object:${CertificateObjectElementKey}`;

function textSelection(key: CertificateTextElementKey): DesignerSelection {
  return `text:${key}`;
}

function objectSelection(key: CertificateObjectElementKey): DesignerSelection {
  return `object:${key}`;
}

function getTextSelectionKey(selection: DesignerSelection) {
  return selection.startsWith("text:") ? (selection.replace("text:", "") as CertificateTextElementKey) : null;
}

function getObjectSelectionKey(selection: DesignerSelection) {
  return selection.startsWith("object:") ? (selection.replace("object:", "") as CertificateObjectElementKey) : null;
}

function updateLayoutElement(
  layoutConfig: CertificateTemplateLayoutConfig,
  key: CertificateTextElementKey,
  patch: Partial<CertificateTextElementLayout>,
) {
  return normalizeCertificateLayoutConfig({
    ...layoutConfig,
    elements: {
      ...layoutConfig.elements,
      [key]: {
        ...layoutConfig.elements[key],
        ...patch,
      },
    },
  });
}

function updateLayoutObjectElement(
  layoutConfig: CertificateTemplateLayoutConfig,
  documentType: CertificateLayoutDocumentType,
  key: CertificateObjectElementKey,
  patch: Partial<CertificateObjectElementLayout>,
) {
  return normalizeCertificateLayoutConfig({
    ...layoutConfig,
    objects: {
      ...layoutConfig.objects,
      [documentType]: {
        ...layoutConfig.objects[documentType],
        [key]: {
          ...layoutConfig.objects[documentType][key],
          ...patch,
        },
      },
    },
  });
}

function updateLayoutDocumentText(
  layoutConfig: CertificateTemplateLayoutConfig,
  documentType: CertificateLayoutDocumentType,
  key: keyof CertificateFixedTextSet,
  value: string,
) {
  return normalizeCertificateLayoutConfig({
    ...layoutConfig,
    documents: {
      ...layoutConfig.documents,
      [documentType]: {
        ...layoutConfig.documents[documentType],
        [key]: value,
      },
    },
  });
}

function SignaturePreview({ layout }: { layout: CertificateObjectElementLayout }) {
  return (
    <div className="text-center" style={{ color: layout.color }}>
      <div className="mx-auto flex items-end justify-center" style={{ height: `${layout.signatureHeight}px` }} />
      <div className="mx-auto mb-2 h-px bg-[#8a651d]" style={{ width: `${layout.lineWidth}%` }} />
      <p className="font-bold leading-tight" style={{ fontSize: `${layout.nameFontSize}px` }}>
        (ชื่อผู้ลงนาม)
      </p>
      <p className="mt-1 font-medium leading-tight" style={{ fontSize: `${layout.positionFontSize}px` }}>
        ตำแหน่งผู้ลงนาม
      </p>
    </div>
  );
}

function QrCodePreview({ layout }: { layout: CertificateObjectElementLayout }) {
  return (
    <div className="grid justify-items-center gap-1 rounded-md bg-white/86 p-3 shadow-sm backdrop-blur-sm">
      <div
        className="grid grid-cols-5 gap-1 bg-white p-1"
        style={{
          width: `${layout.qrSize}px`,
          height: `${layout.qrSize}px`,
        }}
      >
        {Array.from({ length: 25 }).map((_, index) => (
          <span
            key={index}
            className={index % 2 === 0 || index % 7 === 0 ? "bg-[#0b1638]" : "bg-transparent"}
          />
        ))}
      </div>
      <p className="font-semibold" style={{ color: layout.color, fontSize: `${layout.labelFontSize}px` }}>
        ตรวจสอบออนไลน์
      </p>
    </div>
  );
}

function CertificateLayoutPreview({
  backgroundUrl,
  documentType,
  layoutConfig,
  issuerName,
  selectedItem,
}: {
  backgroundUrl: string | null;
  documentType: CertificateLayoutDocumentType;
  layoutConfig: CertificateTemplateLayoutConfig;
  issuerName: string;
  selectedItem: DesignerSelection;
}) {
  const values = { ...sampleValues, issuerName: issuerName || sampleValues.issuerName };
  const textShadow = "0 1px 0 rgba(255,255,255,0.95), 0 0 1px rgba(255,255,255,0.8)";
  const objectDefinitions = getCertificateObjectDefinitionsForDocument(documentType);
  const documentObjects = layoutConfig.objects[documentType];

  return (
    <div className="max-w-full min-w-0 overflow-auto rounded-lg border bg-secondary/20 p-3">
      <div
        className="relative aspect-[1.4137/1] w-[1124px] overflow-hidden rounded-md bg-white bg-cover bg-center shadow-sm"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        }}
      >
        {certificateTextElementDefinitions.map((definition) => {
          const element = layoutConfig.elements[definition.key];
          const text = getCertificateTextElementText(definition.key, documentType, values, layoutConfig);
          return (
            <div
              key={definition.key}
              className={`absolute whitespace-pre-line break-words ${
                selectedItem === textSelection(definition.key) ? "rounded-sm ring-2 ring-sky-400 ring-offset-2" : ""
              }`}
              style={{
                ...getCertificateTextElementStyle(element),
                overflowWrap: "anywhere",
                textShadow,
              }}
            >
              {text}
            </div>
          );
        })}

        {objectDefinitions.map((definition) => {
          const element = documentObjects[definition.key];
          return (
            <div
              key={definition.key}
              className={`absolute ${
                selectedItem === objectSelection(definition.key) ? "rounded-md ring-2 ring-sky-400 ring-offset-2" : ""
              }`}
              style={getCertificateObjectElementStyle(element)}
            >
              {definition.kind === "qr" ? <QrCodePreview layout={element} /> : <SignaturePreview layout={element} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumericControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isInteger(value) ? value : value.toFixed(1)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function CertificateTemplateDesigner({
  formId,
  template,
}: {
  formId: string;
  template: CertificateTemplateSettings;
}) {
  const [documentType, setDocumentType] = useState<CertificateLayoutDocumentType>("certificate");
  const [selectedItem, setSelectedItem] = useState<DesignerSelection>(textSelection("certificateNo"));
  const [layoutConfig, setLayoutConfig] = useState<CertificateTemplateLayoutConfig>(() =>
    normalizeCertificateLayoutConfig(template.layoutConfig),
  );

  const objectDefinitions = getCertificateObjectDefinitionsForDocument(documentType);
  const selectedTextKey = getTextSelectionKey(selectedItem);
  const selectedObjectKey = getObjectSelectionKey(selectedItem);
  const selectedDefinition = selectedTextKey
    ? (certificateTextElementDefinitions.find((definition) => definition.key === selectedTextKey) ??
      certificateTextElementDefinitions[0])
    : null;
  const selectedObjectDefinition = selectedObjectKey
    ? objectDefinitions.find((definition) => definition.key === selectedObjectKey)
    : null;
  const selectedElement = selectedTextKey ? layoutConfig.elements[selectedTextKey] : null;
  const selectedObjectElement = selectedObjectKey ? layoutConfig.objects[documentType][selectedObjectKey] : null;
  const serializedLayoutConfig = useMemo(() => serializeCertificateLayoutConfig(layoutConfig), [layoutConfig]);
  const fixedTextKey = selectedDefinition?.fixedTextKey;
  const fixedTextValue = fixedTextKey ? layoutConfig.documents[documentType][fixedTextKey] : "";
  const sourcePreview = selectedDefinition
    ? getCertificateTextElementText(
        selectedDefinition.key,
        documentType,
        { ...sampleValues, issuerName: template.issuerName || sampleValues.issuerName },
        layoutConfig,
      )
    : "";

  return (
    <>
      <input type="hidden" name="layoutConfigJson" value={serializedLayoutConfig} />

      <div className="grid gap-3 rounded-lg border bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <p className="font-semibold">ตัวจัดวางใบประกาศ</p>
              <p className="text-sm text-muted-foreground">ปรับข้อความ ผู้ลงนาม QR Code และตำแหน่ง พร้อมพรีวิวก่อนบันทึก</p>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                <Eye className="size-4" />
                เปิดพรีวิว
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[96vw] p-0 sm:max-w-[96vw] xl:max-w-[1500px]">
              <DialogHeader className="border-b px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="grid gap-2">
                    <DialogTitle>พรีวิวและจัดวางใบประกาศ</DialogTitle>
                    <DialogDescription>
                      แก้ไขข้อความ ผู้ลงนาม QR Code ตำแหน่ง และขนาดก่อนบันทึกใช้งาน
                    </DialogDescription>
                  </div>
                  <Badge variant="secondary">{documentType === "certificate" ? "ใบประกาศนียบัตร" : "เกียรติบัตร"}</Badge>
                </div>
              </DialogHeader>

              <div className="grid max-h-[calc(90vh-9.5rem)] gap-5 overflow-auto p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid min-w-0 gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {documentTypeOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={documentType === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const selectedObject = getObjectSelectionKey(selectedItem);
                          const nextObjects = getCertificateObjectDefinitionsForDocument(option.value);
                          if (selectedObject && !nextObjects.some((definition) => definition.key === selectedObject)) {
                            setSelectedItem(textSelection("certificateNo"));
                          }
                          setDocumentType(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <CertificateLayoutPreview
                    backgroundUrl={template.backgroundUrl}
                    documentType={documentType}
                    layoutConfig={layoutConfig}
                    issuerName={template.issuerName}
                    selectedItem={selectedItem}
                  />
                </div>

                <div className="grid content-start gap-4">
                  <div className="grid gap-2">
                    <Label>รายการที่ต้องการปรับ</Label>
                    <Select
                      value={selectedItem}
                      onValueChange={(value) => setSelectedItem(value as DesignerSelection)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {certificateTextElementDefinitions.map((definition) => (
                            <SelectItem key={definition.key} value={textSelection(definition.key)}>
                              ข้อความ: {definition.label}
                            </SelectItem>
                          ))}
                          {objectDefinitions.map((definition) => (
                            <SelectItem key={definition.key} value={objectSelection(definition.key)}>
                              ออบเจ็ค: {definition.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDefinition ? (
                    <div className="grid gap-2">
                      <Label>{fixedTextKey ? "ข้อความบรรทัดนี้" : "ข้อความตัวอย่าง"}</Label>
                      <Input
                        value={fixedTextKey ? fixedTextValue : sourcePreview}
                        disabled={!fixedTextKey}
                        onChange={(event) => {
                          if (!fixedTextKey) return;
                          setLayoutConfig((current) =>
                            updateLayoutDocumentText(current, documentType, fixedTextKey, event.target.value),
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Label>ออบเจ็คที่เลือก</Label>
                      <Input value={selectedObjectDefinition?.label ?? ""} disabled />
                    </div>
                  )}

                  {selectedTextKey && selectedElement ? (
                    <div className="grid gap-3 rounded-lg border p-3">
                      <p className="text-sm font-semibold">ตำแหน่งและขนาด</p>
                      <div className="grid grid-cols-3 gap-3">
                        <NumericControl
                          label="X"
                          min={0}
                          max={100}
                          step={0.5}
                          value={selectedElement.x}
                          onChange={(value) =>
                            setLayoutConfig((current) => updateLayoutElement(current, selectedTextKey, { x: value }))
                          }
                        />
                        <NumericControl
                          label="Y"
                          min={0}
                          max={100}
                          step={0.5}
                          value={selectedElement.y}
                          onChange={(value) =>
                            setLayoutConfig((current) => updateLayoutElement(current, selectedTextKey, { y: value }))
                          }
                        />
                        <NumericControl
                          label="กว้าง"
                          min={8}
                          max={100}
                          step={0.5}
                          value={selectedElement.width}
                          onChange={(value) =>
                            setLayoutConfig((current) =>
                              updateLayoutElement(current, selectedTextKey, { width: value }),
                            )
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedTextKey && selectedElement ? (
                    <div className="grid gap-3 rounded-lg border p-3">
                      <p className="text-sm font-semibold">ตัวอักษร</p>
                      <div className="grid grid-cols-2 gap-3">
                        <NumericControl
                          label="ขนาด"
                          min={8}
                          max={72}
                          value={selectedElement.fontSize}
                          onChange={(value) =>
                            setLayoutConfig((current) =>
                              updateLayoutElement(current, selectedTextKey, { fontSize: value }),
                            )
                          }
                        />
                        <NumericControl
                          label="ระยะบรรทัด"
                          min={0.9}
                          max={2}
                          step={0.05}
                          value={selectedElement.lineHeight}
                          onChange={(value) =>
                            setLayoutConfig((current) =>
                              updateLayoutElement(current, selectedTextKey, { lineHeight: value }),
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <Label>ชนิดฟอนต์</Label>
                          <Select
                            value={selectedElement.fontFamily}
                            onValueChange={(value) =>
                              setLayoutConfig((current) =>
                                updateLayoutElement(current, selectedTextKey, {
                                  fontFamily: value as CertificateFontFamily,
                                }),
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {certificateFontOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label>น้ำหนัก</Label>
                            <Select
                              value={selectedElement.fontWeight}
                              onValueChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutElement(current, selectedTextKey, {
                                    fontWeight: value as CertificateFontWeight,
                                  }),
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {fontWeightOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>จัดแนว</Label>
                            <Select
                              value={selectedElement.align}
                              onValueChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutElement(current, selectedTextKey, {
                                    align: value as CertificateTextAlign,
                                  }),
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {textAlignOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>สีตัวอักษร</Label>
                          <Input
                            type="color"
                            value={selectedElement.color}
                            className="h-10 p-1"
                            onChange={(event) =>
                              setLayoutConfig((current) =>
                                updateLayoutElement(current, selectedTextKey, { color: event.target.value }),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedObjectKey && selectedObjectElement ? (
                    <>
                      <div className="grid gap-3 rounded-lg border p-3">
                        <p className="text-sm font-semibold">ตำแหน่งออบเจ็ค</p>
                        <div className="grid grid-cols-3 gap-3">
                          <NumericControl
                            label="X"
                            min={0}
                            max={100}
                            step={0.5}
                            value={selectedObjectElement.x}
                            onChange={(value) =>
                              setLayoutConfig((current) =>
                                updateLayoutObjectElement(current, documentType, selectedObjectKey, { x: value }),
                              )
                            }
                          />
                          <NumericControl
                            label="Y"
                            min={0}
                            max={100}
                            step={0.5}
                            value={selectedObjectElement.y}
                            onChange={(value) =>
                              setLayoutConfig((current) =>
                                updateLayoutObjectElement(current, documentType, selectedObjectKey, { y: value }),
                              )
                            }
                          />
                          <NumericControl
                            label="กว้าง"
                            min={6}
                            max={100}
                            step={0.5}
                            value={selectedObjectElement.width}
                            onChange={(value) =>
                              setLayoutConfig((current) =>
                                updateLayoutObjectElement(current, documentType, selectedObjectKey, { width: value }),
                              )
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>จุดยึด</Label>
                          <Select
                            value={selectedObjectElement.align}
                            onValueChange={(value) =>
                              setLayoutConfig((current) =>
                                updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                  align: value as CertificateTextAlign,
                                }),
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {textAlignOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedObjectDefinition?.kind === "signature" ? (
                        <div className="grid gap-3 rounded-lg border p-3">
                          <p className="text-sm font-semibold">ผู้ลงนาม</p>
                          <div className="grid grid-cols-2 gap-3">
                            <NumericControl
                              label="พื้นที่ลายเซ็น"
                              min={0}
                              max={140}
                              value={selectedObjectElement.signatureHeight}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    signatureHeight: value,
                                  }),
                                )
                              }
                            />
                            <NumericControl
                              label="ความยาวเส้น"
                              min={10}
                              max={100}
                              value={selectedObjectElement.lineWidth}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    lineWidth: value,
                                  }),
                                )
                              }
                            />
                            <NumericControl
                              label="ชื่อผู้ลงนาม"
                              min={8}
                              max={42}
                              value={selectedObjectElement.nameFontSize}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    nameFontSize: value,
                                  }),
                                )
                              }
                            />
                            <NumericControl
                              label="ตำแหน่ง"
                              min={8}
                              max={36}
                              value={selectedObjectElement.positionFontSize}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    positionFontSize: value,
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>สีข้อความ</Label>
                            <Input
                              type="color"
                              value={selectedObjectElement.color}
                              className="h-10 p-1"
                              onChange={(event) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    color: event.target.value,
                                  }),
                                )
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 rounded-lg border p-3">
                          <p className="text-sm font-semibold">QR Code</p>
                          <div className="grid grid-cols-2 gap-3">
                            <NumericControl
                              label="ขนาด QR"
                              min={40}
                              max={180}
                              value={selectedObjectElement.qrSize}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    qrSize: value,
                                  }),
                                )
                              }
                            />
                            <NumericControl
                              label="ข้อความกำกับ"
                              min={8}
                              max={24}
                              value={selectedObjectElement.labelFontSize}
                              onChange={(value) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    labelFontSize: value,
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>สีข้อความ</Label>
                            <Input
                              type="color"
                              value={selectedObjectElement.color}
                              className="h-10 p-1"
                              onChange={(event) =>
                                setLayoutConfig((current) =>
                                  updateLayoutObjectElement(current, documentType, selectedObjectKey, {
                                    color: event.target.value,
                                  }),
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLayoutConfig(defaultCertificateTemplateLayoutConfig)}
                  >
                    คืนค่าเริ่มต้น
                  </Button>
                </div>
              </div>

              <DialogFooter className="border-t px-6 py-4">
                <Button type="submit" form={formId}>
                  <Save className="size-4" />
                  บันทึกใช้งาน
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
