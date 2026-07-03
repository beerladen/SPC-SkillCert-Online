"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListFilter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseCard } from "@/components/site/course-card";
import type { PublicCategory, PublicCourse } from "@/lib/public-repositories";

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function HomeCourseSection({
  categories,
  courses,
}: {
  categories: PublicCategory[];
  courses: PublicCourse[];
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const courseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    courses.forEach((course) => {
      counts.set(course.category.slug, (counts.get(course.category.slug) ?? 0) + 1);
    });
    return counts;
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const keyword = normalizeSearchText(deferredQuery);
    const tokens = keyword.split(" ").filter(Boolean);

    return courses.filter((course) => {
      const matchesCategory = activeCategory === "all" || course.category.slug === activeCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchable = normalizeSearchText(
        [
          course.title,
          course.slug,
          course.shortDescription,
          course.description,
          course.category.name,
          course.instructor.name,
          course.format,
        ].join(" ")
      );

      return tokens.every((token) => searchable.includes(token));
    });
  }, [activeCategory, courses, deferredQuery]);

  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px_minmax(280px,360px)_auto] lg:items-end">
            <div>
              <h2 className="text-2xl font-bold">หลักสูตรเปิดรับสมัคร</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                เลือกหมวดหมู่หรือค้นหาหลักสูตร ระบบจะแสดงผลทันทีในหน้านี้
              </p>
            </div>

            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background px-4 font-semibold shadow-xs">
                <span className="flex min-w-0 items-center gap-3">
                  <ListFilter className="size-5 shrink-0 text-primary" />
                  <SelectValue placeholder="เลือกหมวดหมู่หลักสูตร" />
                </span>
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-80">
                <SelectItem value="all">ทุกหมวดหมู่ ({courses.length})</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.slug} value={category.slug}>
                    {category.icon} {category.name} ({courseCounts.get(category.slug) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex h-11 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 shadow-xs">
              <Search className="size-5 shrink-0 text-primary" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อหลักสูตรหรือผู้สอน"
                className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <Button asChild className="h-11">
              <Link href="/courses">
                หลักสูตรทั้งหมด
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            แสดง {filteredCourses.length} จาก {courses.length} หลักสูตร
          </p>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course, index) => (
              <CourseCard key={course.slug} course={course} priority={index === 0} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="font-semibold">ยังไม่มีหลักสูตรในหมวดนี้</p>
            <p className="mt-2 text-sm text-muted-foreground">
              ลองเปลี่ยนหมวดหมู่หรือคำค้นหา แล้วระบบจะแสดงหลักสูตรที่ตรงกันทันที
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
