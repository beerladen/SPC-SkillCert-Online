"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ResourceItem {
  label: string;
  value: string | number;
}

interface ResourcesCardProps {
  resources: ResourceItem[];
}

export function ResourcesCard({ resources }: ResourcesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resources</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monitor your GPU, vCPU, storage, and endpoint usage.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {resources.map((resource) => (
            <div key={resource.label} className="space-y-2">
              <p className="text-sm text-muted-foreground">{resource.label}</p>
              <p className="text-2xl font-bold">{resource.value}</p>
              <Separator />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
