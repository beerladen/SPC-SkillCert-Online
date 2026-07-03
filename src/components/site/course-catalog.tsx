"use client";

import { useMemo, useState } from "react";
import { Grid2X2, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseCard } from "@/components/site/course-card";
import type { PublicCategory, PublicCourse } from "@/lib/public-repositories";

export function CourseCatalog({
  courses,
  categories,
}: {
  courses: PublicCourse[];
  categories: PublicCategory[];
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [instructor, setInstructor] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const instructors = useMemo(() => {
    const names = new Map<string, string>();
    courses.forEach((course) => {
      names.set(String(course.instructor.id), course.instructor.name);
    });
    return Array.from(names.entries());
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesCategory = category === "all" || course.category.slug === category;
      const matchesInstructor = instructor === "all" || String(course.instructor.id) === instructor;
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        course.title.toLowerCase().includes(normalizedQuery) ||
        course.shortDescription.toLowerCase().includes(normalizedQuery) ||
        course.instructor.name.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesInstructor && matchesQuery;
    });
  }, [category, courses, instructor, query]);

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="font-semibold">หมวดหมู่หลักสูตร</p>
            <Button
              variant={category === "all" ? "default" : "ghost"}
              className="justify-between"
              onClick={() => setCategory("all")}
            >
              <span>ทั้งหมด</span>
              <span>{courses.length}</span>
            </Button>
            {categories.map((item) => {
              const count = courses.filter((course) => course.category.slug === item.slug).length;
              return (
                <Button
                  key={item.slug}
                  variant={category === item.slug ? "default" : "ghost"}
                  className="justify-between"
                  onClick={() => setCategory(item.slug)}
                >
                  <span>
                    {item.icon} {item.name}
                  </span>
                  <span>{count}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </aside>

      <section className="flex flex-col gap-6">
        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_240px_auto]">
          <div className="flex items-center gap-2 rounded-md border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 px-0 shadow-none focus-visible:ring-0"
              placeholder="ค้นหาหลักสูตรเรียนของคุณ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <Select value={instructor} onValueChange={setInstructor}>
            <SelectTrigger>
              <SelectValue placeholder="ผู้สอนทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">ผู้สอนทั้งหมด</SelectItem>
                {instructors.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex rounded-md border p-1">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon"
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <Grid2X2 />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              aria-label="List view"
              onClick={() => setView("list")}
            >
              <List />
            </Button>
          </div>
        </div>

        <div
          className={
            view === "grid"
              ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              : "grid gap-4 md:grid-cols-2"
          }
        >
          {filteredCourses.map((course, index) => (
            <CourseCard key={course.slug} course={course} priority={index === 0} />
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="rounded-lg border bg-card p-10 text-center">
            <p className="font-semibold">ไม่พบหลักสูตรที่ตรงกับเงื่อนไข</p>
            <p className="mt-2 text-sm text-muted-foreground">
              ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือผู้สอน
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
