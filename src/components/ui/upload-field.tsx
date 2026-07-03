"use client";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useId,
  useState,
} from "react";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className" | "onChange"
> & {
  label: string;
  description?: string;
  currentFileName?: string | null;
  currentFileUrl?: string | null;
  maxBytes?: number;
  allowedExtensions?: string[];
  isPending?: boolean;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function normalizeExtensions(extensions: string[] | undefined, accept: string | undefined) {
  if (extensions?.length) {
    return extensions.map((extension) => extension.toLowerCase());
  }

  return (accept ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.startsWith("."));
}

export function UploadField({
  id,
  name,
  label,
  description,
  accept,
  multiple,
  currentFileName,
  currentFileUrl,
  maxBytes,
  allowedExtensions,
  isPending = false,
  className,
  onChange,
  ...props
}: UploadFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const extensions = normalizeExtensions(allowedExtensions, accept);
  const hasSelection = selectedFiles.length > 0;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    let nextValidationMessage: string | null = null;

    for (const file of files) {
      if (maxBytes && file.size > maxBytes) {
        nextValidationMessage = `${file.name} มีขนาดเกิน ${formatBytes(maxBytes)}`;
        break;
      }

      if (extensions.length > 0 && !extensions.includes(fileExtension(file.name))) {
        nextValidationMessage = `${file.name} ยังไม่อยู่ในรูปแบบไฟล์ที่รองรับ`;
        break;
      }
    }

    event.currentTarget.setCustomValidity(nextValidationMessage ?? "");
    setSelectedFiles(files.map((file) => ({ name: file.name, size: file.size })));
    setValidationMessage(nextValidationMessage);
    onChange?.(event);
  };

  return (
    <div
      data-upload-field="true"
      data-upload-name={name}
      className={cn(
        "rounded-lg border bg-secondary/20 p-4 transition",
        validationMessage && "border-destructive/40 bg-destructive/5",
        isPending && "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "rounded-md bg-primary/10 p-2 text-primary",
              validationMessage && "bg-destructive/10 text-destructive",
            )}
          >
            {isPending ? <LoaderCircle className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
          </div>
          <div>
            <p className="font-medium">{label}</p>
            {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
            {currentFileName && (
              <p className="mt-2 text-xs text-muted-foreground">
                ไฟล์เดิม:{" "}
                {currentFileUrl ? (
                  <a href={currentFileUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                    {currentFileName}
                  </a>
                ) : (
                  currentFileName
                )}
              </p>
            )}
          </div>
        </div>

        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition hover:bg-accent hover:text-accent-foreground"
        >
          <FileUp className="size-4" />
          เลือกไฟล์
        </label>
      </div>

      <input
        {...props}
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        tabIndex={-1}
        onChange={handleChange}
      />

      <div className="mt-4 rounded-md border bg-background px-3 py-2 text-sm">
        {isPending ? (
          <span className="flex items-center gap-2 text-primary">
            <LoaderCircle className="size-4 animate-spin" />
            กำลังอัปโหลดและบันทึกข้อมูล...
          </span>
        ) : validationMessage ? (
          <span className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4" />
            {validationMessage}
          </span>
        ) : hasSelection ? (
          <span className="grid gap-1 text-foreground">
            <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              เลือกไฟล์พร้อมอัปโหลดแล้ว
            </span>
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`} className="text-xs text-muted-foreground">
                {file.name} ({formatBytes(file.size)})
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">
            ยังไม่ได้เลือกไฟล์ใหม่{multiple ? " สามารถเลือกได้หลายไฟล์" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
