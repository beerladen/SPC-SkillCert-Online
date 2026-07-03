export function certificateStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    issued: "ออกใบประกาศแล้ว",
    revoked: "ยกเลิกแล้ว",
    reissued: "ออกใหม่แล้ว",
    expired: "หมดอายุ",
  };

  return status ? labels[status] ?? status : "-";
}
