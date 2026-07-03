import Link from "next/link";
import Image from "next/image";
import { Award, CalendarDays, Clock, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CourseStatusBadge } from "@/components/site/status-badge";
import { formatBaht } from "@/lib/format";
import type { PublicCourse } from "@/lib/public-repositories";

export function CourseCard({ course, priority = false }: { course: PublicCourse; priority?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <Link href={`/courses/${course.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <Image
            src={course.coverImage}
            alt={course.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition duration-300 hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            <CourseStatusBadge status={course.status} />
            {course.certificate && (
              <Badge variant="secondary">
                <Award className="size-3" />
                มีใบประกาศ
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <CardHeader className="gap-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">
            {course.category.icon} {course.category.name}
          </Badge>
          <span className="text-xs text-muted-foreground">{course.format}</span>
        </div>
        <Link href={`/courses/${course.slug}`} className="group">
          <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 group-hover:text-primary">
            {course.title}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {course.shortDescription}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback>{course.instructor.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{course.instructor.name}</p>
            <p className="truncate text-xs text-muted-foreground">{course.instructor.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Clock className="size-4" />
            {course.duration}
          </span>
          <span className="flex items-center gap-2">
            <UserRound className="size-4" />
            {course.registered}/{course.capacity ?? "ไม่จำกัด"} คน
          </span>
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {course.startDate}
          </span>
          <span>{course.rating.toFixed(1)} ({course.reviewCount} รีวิว)</span>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">ค่าลงทะเบียน</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">{formatBaht(course.registrationFee)}</span>
            {course.originalFee && (
              <span className="text-sm text-muted-foreground line-through">
                {formatBaht(course.originalFee)}
              </span>
            )}
          </div>
        </div>
        <Button asChild disabled={course.status === "closed"}>
          <Link href={`/courses/${course.slug}`}>ลงทะเบียน</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
