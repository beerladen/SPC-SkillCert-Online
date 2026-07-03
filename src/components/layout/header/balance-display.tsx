"use client";

interface BalanceDisplayProps {
  balance: number;
}

export function BalanceDisplay({ balance }: BalanceDisplayProps) {
  return (
    <div className="flex items-center rounded-lg bg-muted px-3 py-1.5">
      <span className="text-sm font-medium">${balance.toFixed(2)}</span>
    </div>
  );
}
