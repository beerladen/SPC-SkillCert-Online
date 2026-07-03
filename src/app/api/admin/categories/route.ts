import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  deleted_at?: string | null;
}

interface CountRow extends RowDataPacket {
  count_value: number;
}

function slugify(value: string) {
  const asciiSlug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return asciiSlug || `category-${Date.now()}`;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    icon?: string;
    description?: string;
    slug?: string;
  } | null;
  const name = payload?.name?.trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "กรุณากรอกชื่อหมวดหมู่" },
      { status: 400 },
    );
  }

  const icon = payload?.icon?.trim() || "📚";
  const description = payload?.description?.trim() || null;
  const slug = slugify(payload?.slug || name);
  const connection = await getPool().getConnection();

  try {
    const [existingRows] = await connection.execute<CategoryRow[]>(
      "SELECT id, name, slug, icon, description, deleted_at FROM categories WHERE name = ? OR slug = ? LIMIT 1",
      [name, slug],
    );

    if (existingRows[0]) {
      if (existingRows[0].deleted_at) {
        await connection.execute<ResultSetHeader>(
          "UPDATE categories SET name = ?, icon = ?, description = ?, deleted_at = NULL WHERE id = ?",
          [name, icon, description, existingRows[0].id],
        );
      }

      return NextResponse.json({
        ok: true,
        message: existingRows[0].deleted_at
          ? "กู้คืนหมวดหมู่เดิมและเลือกใช้งานแล้ว"
          : "พบหมวดหมู่เดิมในระบบ",
        category: {
          id: Number(existingRows[0].id),
          name,
          slug: existingRows[0].slug,
          icon,
          description,
        },
      });
    }

    const [sortRows] = await connection.execute<Array<RowDataPacket & { sort_order: number }>>(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM categories",
    );
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO categories (name, slug, icon, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [name, slug, icon, description, Number(sortRows[0]?.sort_order ?? 1)],
    );

    return NextResponse.json({
      ok: true,
      message: "เพิ่มหมวดหมู่แล้ว",
      category: {
        id: result.insertId,
        name,
        slug,
        icon,
        description,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "เพิ่มหมวดหมู่ไม่สำเร็จ",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}

export async function DELETE(request: Request) {
  const payload = (await request.json().catch(() => null)) as { id?: number } | null;
  const categoryId = Number(payload?.id ?? 0);

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return NextResponse.json(
      { ok: false, message: "หมวดหมู่ไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const connection = await getPool().getConnection();

  try {
    const [usageRows] = await connection.execute<CountRow[]>(
      "SELECT COUNT(1) AS count_value FROM courses WHERE category_id = ? AND deleted_at IS NULL",
      [categoryId],
    );

    if (Number(usageRows[0]?.count_value ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, message: "ลบหมวดหมู่นี้ไม่ได้ เพราะยังมีหลักสูตรใช้งานอยู่" },
        { status: 409 },
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      "UPDATE categories SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [categoryId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบหมวดหมู่ หรือหมวดหมู่นี้ถูกลบไปแล้ว" },
        { status: 404 },
      );
    }

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      message: "ลบหมวดหมู่แล้ว",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "ลบหมวดหมู่ไม่สำเร็จ",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}
