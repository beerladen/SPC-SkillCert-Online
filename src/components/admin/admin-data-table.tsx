"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface AdminDataTableColumn<T> {
  id: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface AdminDataTableFilter<T> {
  label: string;
  getValue: (row: T) => string;
  options: Array<{ label: string; value: string }>;
}

interface AdminDataTableProps<T> {
  rows: T[];
  columns: Array<AdminDataTableColumn<T>>;
  getRowKey: (row: T) => string;
  getSearchText: (row: T) => string;
  searchPlaceholder?: string;
  filter?: AdminDataTableFilter<T>;
  pageSize?: number;
  emptyText?: string;
}

export function AdminDataTable<T>({
  rows,
  columns,
  getRowKey,
  getSearchText,
  searchPlaceholder = "ค้นหา",
  filter,
  pageSize = 6,
  emptyText = "ไม่พบข้อมูล",
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        keyword.length === 0 || getSearchText(row).toLowerCase().includes(keyword);
      const matchesFilter =
        !filter || filterValue === "all" || filter.getValue(row) === filterValue;
      return matchesSearch && matchesFilter;
    });
  }, [filter, filterValue, getSearchText, rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateFilter = (value: string) => {
    setFilterValue(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-md flex-1 items-center gap-2 rounded-md border bg-background px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder={searchPlaceholder}
          />
        </div>
        {filter && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {filter.label}
            <select
              value={filterValue}
              onChange={(event) => updateFilter(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="all">ทั้งหมด</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="min-w-0 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn("align-top", column.className)}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          แสดง {pageRows.length} จาก {filteredRows.length} รายการ
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="size-4" />
            ก่อนหน้า
          </Button>
          <span className="min-w-20 text-center">
            {currentPage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            ถัดไป
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
