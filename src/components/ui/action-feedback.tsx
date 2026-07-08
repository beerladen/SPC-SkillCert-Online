"use client";

import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionFeedbackVariant = "success" | "error" | "loading" | "info";

interface ActionFeedbackProps {
  variant?: ActionFeedbackVariant;
  title?: string;
  message: string;
  className?: string;
}

const feedbackStyles: Record<ActionFeedbackVariant, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  loading: "border-primary/30 bg-primary/10 text-primary",
  info: "border-border bg-secondary/50 text-foreground",
};

const feedbackIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  loading: LoaderCircle,
  info: Info,
};

export function ActionFeedback({
  variant = "info",
  title,
  message,
  className,
}: ActionFeedbackProps) {
  const Icon = feedbackIcons[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xs", feedbackStyles[variant], className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", variant === "loading" && "animate-spin")} />
      <div className="grid min-w-0 gap-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className="break-words leading-6">{message}</p>
      </div>
    </div>
  );
}
