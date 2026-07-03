"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageData {
  date: string;
  amount: number;
}

interface UsageCardProps {
  rollingAverage: number;
  currentSpendRate: number;
  data: UsageData[];
}

export function UsageCard({ rollingAverage, currentSpendRate, data }: UsageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <p className="text-sm text-muted-foreground">
          Keep an eye on your daily spend with real-time insights.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-muted-foreground">Rolling average</p>
            <p className="text-2xl font-bold">
              ${rollingAverage.toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground"> / day</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current spend rate</p>
            <p className="text-2xl font-bold">
              ${currentSpendRate.toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground"> / hr</span>
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#888' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#888' }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="#4F7DF3" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
