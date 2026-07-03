from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin  # noqa: F401


ROOT = Path(__file__).resolve().parents[1]
COURSE_SLUG = "ai-office-productivity-12h-free"
UPLOAD_ROOT = ROOT / "public" / "uploads" / "ai-office-productivity-free"
TMP_ROOT = ROOT / "tmp" / "ai-office-productivity-free"
PYDEPS = ROOT / "tmp" / "pydeps"

FONT_REGULAR = Path("C:/Windows/Fonts/tahoma.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/tahomabd.ttf")
SARABUN = Path("C:/Windows/Fonts/THSarabunNew.ttf")
SARABUN_BOLD = Path("C:/Windows/Fonts/THSarabunNew Bold.ttf")

PRIMARY = "#18605b"
SECONDARY = "#f2b84b"
DARK = "#1c2630"
MUTED = "#5e6873"
LIGHT = "#f6f8f7"
WHITE = "#ffffff"
BLUE = "#2a6fbb"
GREEN = "#2f8a5f"
RED = "#b8453d"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        FONT_BOLD if bold else FONT_REGULAR,
        SARABUN_BOLD if bold else SARABUN,
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def ensure_dirs() -> None:
    for path in [
        UPLOAD_ROOT,
        UPLOAD_ROOT / "covers",
        UPLOAD_ROOT / "knowledge",
        UPLOAD_ROOT / "worksheets",
        UPLOAD_ROOT / "assessments",
        UPLOAD_ROOT / "samples",
        UPLOAD_ROOT / "videos",
        UPLOAD_ROOT / "teacher",
        TMP_ROOT,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split(" ")
        current = ""
        for word in words:
            test = word if not current else f"{current} {word}"
            if text_size(draw, test, fnt)[0] <= max_width:
                current = test
                continue
            if current:
                lines.append(current)
            if text_size(draw, word, fnt)[0] <= max_width:
                current = word
            else:
                chunk = ""
                for char in word:
                    test_chunk = chunk + char
                    if text_size(draw, test_chunk, fnt)[0] <= max_width:
                        chunk = test_chunk
                    else:
                        if chunk:
                            lines.append(chunk)
                        chunk = char
                current = chunk
        if current:
            lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 8,
) -> int:
    x, y = xy
    for line in wrap_text(draw, text, fnt, max_width):
        if not line:
            y += fnt.size + line_gap
            continue
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_cover() -> str:
    width, height = 1200, 675
    img = Image.new("RGB", (width, height), "#f4f7f5")
    draw = ImageDraw.Draw(img)

    for i in range(height):
        shade = int(246 - i * 0.035)
        draw.line((0, i, width, i), fill=(shade, max(235, shade - 5), max(230, shade - 8)))

    draw.polygon([(760, 0), (1200, 0), (1200, 675), (860, 675), (700, 390)], fill="#d9ece7")
    draw.polygon([(920, 0), (1200, 0), (1200, 300), (1020, 260)], fill="#f7d77c")
    draw.ellipse((770, 95, 1120, 445), fill="#ffffff", outline="#c6ded8", width=5)
    draw.ellipse((835, 155, 1055, 375), fill="#e5f5f1", outline=PRIMARY, width=6)
    draw.text((900, 185), "AI", font=font(78, True), fill=PRIMARY)
    draw.line((875, 285, 1015, 285), fill=SECONDARY, width=10)
    for x, y in [(805, 205), (1095, 270), (930, 420), (1130, 145)]:
        draw.ellipse((x, y, x + 22, y + 22), fill=SECONDARY)
    for x, y in [(805, 216), (875, 260), (930, 431), (1095, 281)]:
        draw.line((930, 265, x, y), fill="#87bdb2", width=3)

    rounded_rect(draw, (72, 62, 272, 110), 24, PRIMARY)
    draw.text((102, 72), "หลักสูตรฟรี", font=font(24, True), fill=WHITE)
    draw.text((72, 150), "การใช้ AI ช่วยงานเอกสาร", font=font(60, True), fill=DARK)
    draw.text((72, 224), "และงานสำนักงานดิจิทัล", font=font(60, True), fill=DARK)
    draw.text((76, 316), "12 ชั่วโมง | เริ่มต้นใช้งานได้จริง | มีใบงานและชิ้นงานสรุป", font=font(28, True), fill=PRIMARY)
    draw_wrapped(
        draw,
        (76, 378),
        "เรียนรู้การเขียน Prompt การสรุปเอกสาร การวิเคราะห์ข้อมูลเบื้องต้น และการสร้างชุดงานสำนักงานด้วย AI อย่างปลอดภัย",
        font(26),
        MUTED,
        620,
        10,
    )
    draw.text((76, 584), "ครูเจ้าของหลักสูตร: นายธารา แสงเพ็ชร", font=font(25, True), fill=DARK)
    draw.text((76, 618), "SPC SkillCert Online", font=font(22), fill=MUTED)

    out = UPLOAD_ROOT / "covers" / "ai-office-productivity-cover.png"
    img.save(out, quality=95)
    return url(out)


def page(title: str, subtitle: str | None = None) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (1240, 1754), WHITE)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 1240, 112), fill=PRIMARY)
    draw.text((64, 34), "SPC SkillCert Online", font=font(30, True), fill=WHITE)
    draw.rectangle((0, 112, 1240, 124), fill=SECONDARY)
    draw.text((64, 172), title, font=font(44, True), fill=DARK)
    if subtitle:
        draw_wrapped(draw, (66, 232), subtitle, font(24), MUTED, 1080, 8)
    return img, draw


def add_footer(draw: ImageDraw.ImageDraw, page_no: int) -> None:
    draw.line((64, 1650, 1176, 1650), fill="#d7dfdc", width=2)
    draw.text((64, 1674), "หลักสูตรฟรี: การใช้ AI ช่วยงานเอกสารและงานสำนักงานดิจิทัล", font=font(18), fill=MUTED)
    draw.text((1118, 1674), str(page_no), font=font(18, True), fill=MUTED)


def add_section_header(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, color: str = PRIMARY) -> int:
    rounded_rect(draw, (x, y, x + 24, y + 24), 8, color)
    draw.text((x + 38, y - 4), text, font=font(28, True), fill=DARK)
    return y + 50


def add_bullets(draw: ImageDraw.ImageDraw, x: int, y: int, items: list[str], max_width: int = 1020, fsize: int = 23) -> int:
    bullet_font = font(fsize)
    for item in items:
        draw.ellipse((x, y + 9, x + 9, y + 18), fill=PRIMARY)
        y = draw_wrapped(draw, (x + 24, y), item, bullet_font, DARK, max_width, 7) + 8
    return y


def add_table(draw: ImageDraw.ImageDraw, x: int, y: int, widths: list[int], rows: list[list[str]], header: bool = True, row_min: int = 58) -> int:
    current_y = y
    for row_idx, row in enumerate(rows):
        cell_lines: list[list[str]] = []
        max_lines = 1
        for col_idx, text in enumerate(row):
            f = font(20, row_idx == 0 and header)
            lines = wrap_text(draw, str(text), f, widths[col_idx] - 24)
            cell_lines.append(lines)
            max_lines = max(max_lines, len(lines))
        row_height = max(row_min, max_lines * 30 + 24)
        current_x = x
        fill = "#e8f3f0" if row_idx == 0 and header else ("#fbfcfc" if row_idx % 2 == 0 else WHITE)
        for col_idx, text in enumerate(row):
            draw.rectangle((current_x, current_y, current_x + widths[col_idx], current_y + row_height), fill=fill, outline="#cfd9d6", width=2)
            ty = current_y + 14
            f = font(20, row_idx == 0 and header)
            for line in cell_lines[col_idx]:
                draw.text((current_x + 12, ty), line, font=f, fill=DARK)
                ty += 30
            current_x += widths[col_idx]
        current_y += row_height
    return current_y + 18


def save_pdf(name: str, pages: list[Image.Image]) -> str:
    out = UPLOAD_ROOT / name
    out.parent.mkdir(parents=True, exist_ok=True)
    rgb_pages = [p.convert("RGB") for p in pages]
    rgb_pages[0].save(out, save_all=True, append_images=rgb_pages[1:], resolution=150.0)
    return url(out)


def url(path: Path) -> str:
    rel = path.relative_to(ROOT / "public").as_posix()
    return f"/{rel}"


def make_text_pdf(file_name: str, title: str, subtitle: str, blocks: list[dict]) -> str:
    pages: list[Image.Image] = []
    img, draw = page(title, subtitle)
    y = 320
    page_no = 1
    for block in blocks:
        estimated = 120 + sum(len(str(i)) // 42 * 28 + 40 for i in block.get("items", []))
        if y + estimated > 1580:
            add_footer(draw, page_no)
            pages.append(img)
            page_no += 1
            img, draw = page(title)
            y = 180
        y = add_section_header(draw, 74, y, block["heading"], block.get("color", PRIMARY))
        if "paragraph" in block:
            y = draw_wrapped(draw, (78, y), block["paragraph"], font(23), DARK, 1060, 9) + 18
        if "items" in block:
            y = add_bullets(draw, 84, y, block["items"], 1020, 22) + 10
        if "table" in block:
            widths = block["table"]["widths"]
            rows = block["table"]["rows"]
            y = add_table(draw, 78, y, widths, rows, row_min=block["table"].get("row_min", 58))
    add_footer(draw, page_no)
    pages.append(img)
    return save_pdf(file_name, pages)


def write_text_file(path: Path, content: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")
    return url(path)


def write_csv_file(path: Path, rows: list[dict], fields: list[str]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return url(path)


def question(text_: str, a: str, b: str, c: str, d: str, answer: str, explanation: str, score: int = 1) -> dict:
    return {
        "question": text_,
        "choice_a": a,
        "choice_b": b,
        "choice_c": c,
        "choice_d": d,
        "answer": answer,
        "score": score,
        "explanation": explanation,
    }


def make_questions() -> tuple[list[dict], list[dict], list[dict]]:
    pre = [
        question("ข้อใดเป็นการใช้ AI ที่เหมาะสมที่สุดในงานสำนักงาน", "ส่งข้อมูลบัตรประชาชนให้ AI ตรวจ", "ให้ AI ช่วยร่างข้อความแล้วมนุษย์ตรวจทาน", "คัดลอกคำตอบ AI ส่งทันที", "ใช้ AI แทนการตัดสินใจทั้งหมด", "ข", "AI ควรเป็นผู้ช่วย มนุษย์ยังต้องตรวจสอบความถูกต้องและความเหมาะสม"),
        question("Prompt ที่ดีควรมีองค์ประกอบใด", "บทบาท งาน บริบท รูปแบบผลลัพธ์", "คำสั่งสั้นที่สุดเท่านั้น", "ข้อมูลส่วนตัวให้มากที่สุด", "คำถามกว้าง ๆ โดยไม่ระบุเป้าหมาย", "ก", "Prompt ที่ชัดเจนช่วยให้ AI สร้างคำตอบตรงงานมากขึ้น"),
        question("ข้อมูลใดไม่ควรใส่ใน AI สาธารณะ", "หัวข้อเอกสารทั่วไป", "รูปแบบรายงานที่ต้องการ", "เลขบัตรประชาชนและข้อมูลลูกค้า", "ตัวอย่างข้อความที่ไม่ระบุตัวตน", "ค", "ข้อมูลส่วนบุคคลและข้อมูลลับต้องหลีกเลี่ยงหรือทำให้ไม่ระบุตัวตนก่อน"),
        question("การตรวจสอบคำตอบจาก AI ควรทำอย่างไร", "เชื่อทั้งหมด", "ตรวจแหล่งอ้างอิงและเทียบกับบริบทจริง", "ดูแค่คำตอบยาวหรือสั้น", "ส่งต่อทันทีถ้าภาษาอ่านดี", "ข", "AI อาจให้ข้อมูลผิดหรือไม่เหมาะกับบริบท จึงต้องตรวจสอบ"),
        question("การให้ AI ช่วยสรุปเอกสาร ควรระบุอะไรเพิ่ม", "จำนวนบรรทัดหรือรูปแบบสรุป", "รหัสผ่านไฟล์", "ข้อมูลลับทั้งหมด", "ไม่ต้องระบุอะไร", "ก", "การกำหนดรูปแบบ เช่น bullet 5 ข้อ ช่วยให้ผลลัพธ์นำไปใช้ได้ง่าย"),
        question("ข้อใดเป็นผลลัพธ์ที่ควรขอจาก AI เมื่อทำรายงานจากตาราง", "สรุปแนวโน้มและข้อสังเกต", "เดาตัวเลขที่ไม่มีในข้อมูล", "ลบข้อมูลผิดพลาดเองโดยไม่แจ้ง", "ยืนยันว่าทุกอย่างถูกต้องแน่นอน", "ก", "AI ช่วยสรุปแนวโน้มได้ แต่ต้องไม่แต่งข้อมูลเพิ่ม"),
        question("เมื่อ AI สร้างข้อความราชการ ควรทำสิ่งใดก่อนใช้จริง", "ตรวจคำขึ้นต้น ลงท้าย และความสุภาพ", "ส่งทันที", "ลบชื่อผู้รับทั้งหมด", "ทำให้ยาวที่สุด", "ก", "เอกสารราชการต้องตรวจรูปแบบและระดับภาษาให้เหมาะสม"),
        question("Prompt Template มีประโยชน์อย่างไร", "ทำให้ทำงานซ้ำได้เป็นระบบ", "ทำให้ไม่ต้องตรวจงาน", "ใช้แทนข้อมูลจริงทั้งหมด", "ทำให้ AI ไม่เคยผิด", "ก", "Template ช่วยลดเวลาตั้งคำสั่งและควบคุมคุณภาพงานซ้ำ ๆ"),
        question("ข้อใดคือหลักฐานประกอบใบงานที่ดี", "ภาพหน้าจอ Prompt และผลลัพธ์ก่อนปรับแก้", "ข้อความสั้นว่าเสร็จแล้ว", "ไฟล์เปล่า", "ลิงก์ที่เปิดไม่ได้", "ก", "หลักฐานช่วยให้ครูเห็นกระบวนการคิดและการปรับแก้"),
        question("เป้าหมายหลักของหลักสูตรนี้คืออะไร", "ใช้ AI อย่างปลอดภัยและสร้างงานสำนักงานได้จริง", "เรียนเขียนโปรแกรม AI ขั้นสูง", "สร้างโมเดล AI จากศูนย์", "สอบใบอนุญาตวิศวกร", "ก", "หลักสูตรเน้นงานเอกสาร ข้อมูล และสื่อสำนักงานสำหรับผู้เริ่มต้น"),
    ]
    quiz = [
        question("สูตร Prompt แบบ R-T-F หมายถึงอะไร", "Role-Task-Format", "Read-Test-Fix", "Run-Table-File", "Role-Time-File", "ก", "Role-Task-Format เป็นโครงง่ายสำหรับสั่ง AI"),
        question("ถ้าต้องการให้ AI เขียนอีเมลสุภาพ ควรระบุอะไร", "ผู้รับ วัตถุประสงค์ น้ำเสียง และความยาว", "เฉพาะคำว่าเขียนอีเมล", "ข้อมูลลับของทุกฝ่าย", "ไม่ต้องระบุบริบท", "ก", "บริบทและน้ำเสียงทำให้อีเมลเหมาะกับสถานการณ์"),
        question("การสรุปเอกสารประชุมควรให้ AI ส่งออกเป็นรูปแบบใดจึงอ่านง่าย", "หัวข้อสำคัญ มติ งานที่ต้องทำ ผู้รับผิดชอบ", "ย่อหน้าเดียวไม่มีหัวข้อ", "คำตอบเป็นภาษาใดก็ได้", "ตัวเลขสุ่ม", "ก", "สรุปประชุมควรแยกประเด็นและ action item ชัดเจน"),
        question("การปรับภาษาจาก AI ควรขออะไรเพิ่ม", "ระดับภาษาและกลุ่มผู้อ่าน", "ให้ยาวที่สุด", "ให้ตัดข้อมูลสำคัญ", "ให้แปลโดยไม่ตรวจ", "ก", "ภาษาต้องเหมาะกับผู้รับสาร"),
        question("ข้อใดคือ Prompt ที่ชัดเจนกว่า", "ช่วยเขียนรายงาน", "คุณเป็นเจ้าหน้าที่ธุรการ ช่วยร่างรายงานประชุม 1 หน้า ภาษาเป็นทางการ มีหัวข้อวาระ มติ และงานต่อไป", "ทำให้ดี", "เขียนอะไรก็ได้", "ข", "Prompt ระบุบทบาท งาน รูปแบบ และข้อจำกัดชัดเจน"),
        question("เมื่อใช้ AI สรุปไฟล์ยาว ควรตรวจอะไร", "สาระสำคัญไม่หายและไม่มีข้อมูลแต่งเพิ่ม", "จำนวนคำมากที่สุด", "ความเร็วอย่างเดียว", "สีตัวอักษร", "ก", "สรุปต้องถูกต้อง ครบ และไม่แต่งข้อเท็จจริง"),
        question("ข้อใดเป็นการทำข้อมูลให้ปลอดภัยก่อนส่งเข้า AI", "แทนชื่อจริงด้วยรหัส เช่น ผู้เรียน A", "ใส่เบอร์โทรทุกคน", "ใส่เลขบัญชี", "ส่งไฟล์ทั้งระบบ", "ก", "การไม่ระบุตัวตนลดความเสี่ยงข้อมูลส่วนบุคคล"),
        question("AI เหมาะกับงานใดในเอกสารสำนักงาน", "ช่วยร่างและตรวจสำนวน", "อนุมัติเอกสารแทนหัวหน้า", "รับรองข้อเท็จจริงโดยไม่ตรวจ", "เปิดเผยข้อมูลลับ", "ก", "AI ช่วยงานร่างและปรับแก้ได้ แต่การอนุมัติเป็นหน้าที่มนุษย์"),
        question("Output format ใน Prompt คืออะไร", "รูปแบบคำตอบที่ต้องการ เช่น ตาราง bullet หรือรายงาน", "ชื่อเครื่องคอมพิวเตอร์", "รหัสผ่าน", "เวลาที่ใช้", "ก", "การระบุรูปแบบช่วยให้ผลลัพธ์พร้อมใช้งาน"),
        question("ถ้าผลลัพธ์ AI ยังไม่ดี ควรทำอย่างไร", "ปรับ Prompt เพิ่มตัวอย่างและข้อจำกัด", "ยอมรับทันที", "ลบทิ้งเสมอ", "ส่งข้อมูลลับเพิ่ม", "ก", "การปรับ Prompt เป็นกระบวนการทดลองและปรับปรุง"),
    ]
    post = pre + [
        question("เมื่อให้ AI วิเคราะห์ตารางยอดขาย ควรแนบอะไรไปกับคำสั่ง", "คำอธิบายคอลัมน์และเป้าหมายการวิเคราะห์", "เลขบัญชีลูกค้า", "ข้อมูลที่ไม่เกี่ยวข้อง", "คำสั่งว่าเดาเอง", "ก", "AI ต้องรู้ความหมายของคอลัมน์และคำถามธุรกิจ"),
        question("ข้อใดคือข้อเสนอแนะที่ดีจากรายงาน AI", "อิงจากข้อมูลที่เห็นและระบุเหตุผล", "ฟันธงโดยไม่มีข้อมูล", "แนะนำทุกอย่างพร้อมกัน", "คัดลอกข้อความเดิมทั้งหมด", "ก", "ข้อเสนอแนะควรเชื่อมกับข้อมูลและเหตุผล"),
        question("การสร้างสไลด์ด้วย AI ควรขอรูปแบบใด", "หัวข้อสไลด์ ประเด็นสำคัญ และคำพูดประกอบ", "ข้อความยาวเต็มหน้า", "คำตอบไม่มีโครงสร้าง", "เฉพาะรูปภาพ", "ก", "โครงสไลด์ช่วยนำไปผลิตต่อได้ง่าย"),
        question("ถ้า AI แนะนำสูตร Excel ควรทำอย่างไร", "ทดสอบกับข้อมูลตัวอย่างและตรวจผลลัพธ์", "ใช้ทันทีโดยไม่ลอง", "ลบสูตรเดิมทั้งหมด", "ส่งข้อมูลลับเพิ่ม", "ก", "สูตรต้องทดสอบกับข้อมูลจริงหรือตัวอย่างก่อนใช้งาน"),
        question("ชิ้นงานสุดท้ายควรแสดงอะไร", "เอกสาร รายงานข้อมูล โครงสไลด์ และหลักฐาน Prompt", "เฉพาะคำตอบ AI ดิบ", "ไฟล์เปล่า", "ภาพหน้าจออย่างเดียว", "ก", "ชิ้นงานต้องพิสูจน์การประยุกต์ใช้ AI ครบกระบวนการ"),
        question("การอ้างว่า AI ถูกต้อง 100% เป็นอย่างไร", "ไม่เหมาะสม เพราะ AI อาจผิดพลาด", "ถูกเสมอ", "ควรใช้ในเอกสารทางการ", "ทำให้ไม่ต้องตรวจงาน", "ก", "AI เป็นเครื่องมือช่วยคิด ไม่ใช่แหล่งความจริงสุดท้าย"),
        question("ข้อใดเป็นวิธีเขียน Prompt สำหรับเปลี่ยนภาษารายงานให้อ่านง่าย", "ระบุกลุ่มผู้อ่าน น้ำเสียง และตัวอย่างสำนวน", "บอกว่าเขียนใหม่เฉย ๆ", "ให้ตัดทุกตัวเลข", "ให้เพิ่มข้อมูลที่ไม่มี", "ก", "การระบุกลุ่มผู้อ่านและน้ำเสียงทำให้ผลลัพธ์ตรงงาน"),
        question("การส่งงานแบบ file_or_link หมายถึงอะไร", "ส่งเป็นไฟล์หรือลิงก์ก็ได้", "ส่งได้เฉพาะข้อความ", "ห้ามส่งไฟล์", "ต้องส่งทางอีเมลเท่านั้น", "ก", "ระบบรองรับทั้งไฟล์และลิงก์สำหรับใบงาน"),
        question("Rubric มีไว้เพื่ออะไร", "กำหนดเกณฑ์ตรวจงานให้ชัดและสม่ำเสมอ", "แทนการเรียนทั้งหมด", "ซ่อนคะแนน", "ใช้กับครูเท่านั้นไม่เกี่ยวกับผู้เรียน", "ก", "Rubric ช่วยให้ผู้เรียนรู้เป้าหมายและครูตรวจได้เป็นมาตรฐาน"),
        question("ข้อใดควรทำก่อนเผยแพร่เอกสารที่ AI ช่วยร่าง", "ตรวจความถูกต้อง ภาษา รูปแบบ และข้อมูลส่วนบุคคล", "เผยแพร่ทันที", "ใส่ข้อมูลทุกอย่างเพิ่ม", "ลบชื่อหน่วยงานเสมอ", "ก", "เอกสารต้องตรวจครบทั้งสาระ ภาษา รูปแบบ และความปลอดภัย"),
    ]
    return pre, quiz, post


def build_pdfs() -> dict[str, str]:
    outline = make_text_pdf(
        "teacher/course-outline-ai-office-12h.pdf",
        "แผนหลักสูตร 12 ชั่วโมง",
        "การใช้ AI ช่วยงานเอกสารและงานสำนักงานดิจิทัล - หลักสูตรฟรีโดยนายธารา แสงเพ็ชร",
        [
            {
                "heading": "ภาพรวมหลักสูตร",
                "paragraph": "หลักสูตรระยะสั้นสำหรับผู้เริ่มต้นที่ต้องการใช้ AI ช่วยงานสำนักงานอย่างปลอดภัยและได้ชิ้นงานจริง ผู้เรียนจะฝึกตั้งคำสั่ง สรุปเอกสาร วิเคราะห์ข้อมูลเบื้องต้น และสร้างชุดงานสำนักงานดิจิทัล",
            },
            {
                "heading": "โครงสร้างเวลา",
                "table": {
                    "widths": [110, 520, 170, 300],
                    "rows": [
                        ["หน่วย", "หัวข้อ", "เวลา", "ผลงาน"],
                        ["1", "พื้นฐาน AI และความปลอดภัยของข้อมูล", "3 ชม.", "แบบทดสอบก่อนเรียนและ checklist ความปลอดภัย"],
                        ["2", "Prompt สำหรับเอกสารและการสรุป", "3 ชม.", "ใบงานร่างเอกสารและปรับภาษา"],
                        ["3", "AI กับข้อมูล ตาราง และรายงาน", "3 ชม.", "แบบฝึกวิเคราะห์ข้อมูลจากไฟล์ CSV"],
                        ["4", "สร้างชุดงานสำนักงานดิจิทัล", "3 ชม.", "ชิ้นงานสุดท้ายพร้อมหลักฐาน Prompt"],
                    ],
                },
            },
            {
                "heading": "เกณฑ์ผ่าน",
                "items": [
                    "เรียนครบไม่น้อยกว่า 80% ของบทเรียนที่เผยแพร่",
                    "ทำ Post-test ได้ไม่น้อยกว่า 70%",
                    "ส่งใบงานและแบบฝึกครบทุกชิ้น",
                    "ชิ้นงานสุดท้ายได้คะแนนไม่น้อยกว่า 70%",
                    "ใช้ AI โดยไม่เปิดเผยข้อมูลลับหรือข้อมูลส่วนบุคคล",
                ],
            },
        ],
    )

    knowledge_1 = make_text_pdf(
        "knowledge/unit-01-ai-basics-safety.pdf",
        "ใบความรู้หน่วยที่ 1",
        "พื้นฐาน AI และการใช้งานอย่างปลอดภัย",
        [
            {"heading": "จุดประสงค์", "items": ["อธิบายบทบาทของ AI ในงานสำนักงานได้", "แยกงานที่เหมาะ/ไม่เหมาะกับ AI ได้", "ใช้ข้อมูลกับ AI อย่างระมัดระวัง"]},
            {"heading": "แนวคิดสำคัญ", "items": ["AI เป็นผู้ช่วยร่าง สรุป จัดหมวดหมู่ และเสนอทางเลือก", "คำตอบจาก AI ต้องตรวจสอบเสมอ เพราะอาจผิดบริบทหรือแต่งข้อมูล", "หลีกเลี่ยงการใส่ข้อมูลลับ เช่น เลขบัตรประชาชน เบอร์โทร รายชื่อลูกค้า หรือเอกสารภายในที่ไม่ได้รับอนุญาต"]},
            {"heading": "ขั้นตอนใช้งานปลอดภัย", "items": ["ตัดข้อมูลส่วนบุคคลออกหรือแทนด้วยรหัส", "บอก AI ให้ระบุข้อจำกัดหรือจุดที่ไม่แน่ใจ", "ตรวจคำตอบกับเอกสารต้นฉบับหรือแหล่งข้อมูลที่เชื่อถือได้", "บันทึก Prompt และผลลัพธ์ไว้เป็นหลักฐานการทำงาน"]},
            {"heading": "แบบฝึกสั้น", "items": ["เลือกงานสำนักงาน 1 งานที่อยากให้ AI ช่วย", "เขียนข้อมูลที่ปลอดภัยสำหรับทดลอง", "ระบุข้อมูลที่ห้ามส่งเข้า AI อย่างน้อย 3 รายการ"]},
        ],
    )
    knowledge_2 = make_text_pdf(
        "knowledge/unit-02-prompt-document.pdf",
        "ใบความรู้หน่วยที่ 2",
        "Prompt สำหรับเอกสารและการสรุป",
        [
            {"heading": "สูตร Prompt ใช้งานง่าย", "paragraph": "ใช้โครง R-T-F-C: Role คือบทบาท, Task คืองาน, Format คือรูปแบบผลลัพธ์, Constraint คือข้อจำกัด เช่น ความยาว น้ำเสียง หรือข้อมูลที่ห้ามแต่งเพิ่ม"},
            {"heading": "ตัวอย่าง Prompt", "items": [
                "คุณเป็นเจ้าหน้าที่ธุรการ ช่วยร่างอีเมลแจ้งกำหนดส่งเอกสารให้ผู้เข้าอบรม ใช้น้ำเสียงสุภาพ กระชับ ไม่เกิน 120 คำ",
                "สรุปข้อความต่อไปนี้เป็น 5 bullet โดยแยกหัวข้อ มติ และงานที่ต้องติดตาม ห้ามเพิ่มข้อมูลที่ไม่มีในต้นฉบับ",
                "ปรับภาษารายงานนี้ให้เป็นทางการ เหมาะสำหรับส่งหัวหน้างาน และคงตัวเลขเดิมทุกจุด",
            ]},
            {"heading": "เทคนิคตรวจงาน", "items": ["ตรวจข้อเท็จจริงและตัวเลข", "ตรวจชื่อบุคคล หน่วยงาน วันที่ และเอกสารแนบ", "อ่านออกเสียงเพื่อดูความลื่นไหล", "ขอ AI สร้างเวอร์ชันสั้น/ยาวแล้วเลือกใช้ตามบริบท"]},
        ],
    )
    knowledge_3 = make_text_pdf(
        "knowledge/unit-03-ai-data-report.pdf",
        "ใบความรู้หน่วยที่ 3",
        "AI กับตารางข้อมูลและรายงาน",
        [
            {"heading": "หลักคิด", "items": ["AI ช่วยอ่านแนวโน้มและอธิบายตารางได้ แต่ไม่ควรเดาข้อมูลที่ไม่มี", "ก่อนส่งข้อมูลเข้า AI ควรลบข้อมูลส่วนบุคคลและอธิบายความหมายคอลัมน์", "รายงานที่ดีต้องมีข้อค้นพบ เหตุผล และข้อเสนอแนะที่อิงข้อมูล"]},
            {"heading": "Prompt วิเคราะห์ข้อมูล", "paragraph": "จากตารางต่อไปนี้ ช่วยสรุปแนวโน้ม 3 ข้อ ระบุจุดที่ควรติดตาม และเสนอแนวทางปรับปรุง 2 ข้อ โดยห้ามแต่งตัวเลขที่ไม่มีในตาราง"},
            {"heading": "โครงรายงาน 1 หน้า", "items": ["ชื่อรายงานและช่วงข้อมูล", "ข้อค้นพบสำคัญ", "ตาราง/ตัวเลขสนับสนุน", "ข้อเสนอแนะ", "ข้อจำกัดของข้อมูล"]},
        ],
    )
    knowledge_4 = make_text_pdf(
        "knowledge/unit-04-final-office-package.pdf",
        "ใบความรู้หน่วยที่ 4",
        "สร้างชุดงานสำนักงานดิจิทัลด้วย AI",
        [
            {"heading": "เป้าหมายชิ้นงาน", "paragraph": "ผู้เรียนรวมทักษะทั้งหมดเพื่อสร้างชุดเอกสารสำนักงาน 1 ชุด ประกอบด้วยเอกสารสรุป รายงานข้อมูล โครงสไลด์ และหลักฐานการใช้ Prompt อย่างปลอดภัย"},
            {"heading": "องค์ประกอบที่ต้องมี", "items": ["เอกสารสรุปหรือบันทึกข้อความ 1 หน้า", "รายงานข้อมูลจากไฟล์ตัวอย่าง 1 หน้า", "โครงสไลด์นำเสนอ 5-7 สไลด์", "ภาพหน้าจอ Prompt หรือบันทึกขั้นตอนอย่างน้อย 3 รายการ", "คำอธิบายว่าตรวจและแก้ผลลัพธ์ AI อย่างไร"]},
            {"heading": "Checklist ก่อนส่ง", "items": ["ไม่มีข้อมูลส่วนบุคคลหรือข้อมูลลับ", "ตัวเลขตรงกับไฟล์ข้อมูล", "ภาษาเหมาะกับผู้รับสาร", "จัดรูปแบบอ่านง่าย", "แนบไฟล์หรือลิงก์เปิดได้จริง"]},
        ],
    )

    worksheet_1 = make_text_pdf(
        "worksheets/worksheet-01-prompt-document.pdf",
        "ใบงานที่ 1",
        "ร่างเอกสารสำนักงานด้วย Prompt",
        [
            {"heading": "สถานการณ์", "paragraph": "ศูนย์อบรมต้องแจ้งผู้เข้าอบรมเรื่องการเตรียมเอกสารก่อนเข้าเรียนออนไลน์ ให้ผู้เรียนใช้ AI ช่วยร่างอีเมลหรือประกาศ 1 ฉบับ"},
            {"heading": "สิ่งที่ต้องทำ", "items": ["เขียน Prompt อย่างน้อย 2 เวอร์ชัน", "เลือกผลลัพธ์ที่ดีที่สุดและปรับแก้ด้วยตนเอง", "ส่งไฟล์เอกสารสุดท้าย พร้อมหลักฐาน Prompt ก่อน/หลังปรับแก้"]},
            {"heading": "เกณฑ์คะแนน", "table": {"widths": [520, 160, 420], "rows": [["รายการประเมิน", "คะแนน", "คำอธิบาย"], ["Prompt ชัดเจน", "25", "มีบทบาท งาน รูปแบบ และข้อจำกัด"], ["ภาษาเหมาะสม", "25", "สุภาพ กระชับ ใช้ได้จริง"], ["การปรับแก้", "25", "ไม่คัดลอก AI ดิบ ตรวจและปรับบริบท"], ["หลักฐานครบ", "25", "แนบ Prompt และผลลัพธ์ครบ"]]}},
        ],
    )
    worksheet_2 = make_text_pdf(
        "worksheets/worksheet-02-summary-revision.pdf",
        "ใบงานที่ 2",
        "สรุปเอกสารและปรับภาษา",
        [
            {"heading": "โจทย์", "paragraph": "ใช้ไฟล์ตัวอย่าง sample-source-document.txt ให้ AI ช่วยสรุปเป็น 5 bullet และปรับเป็นบันทึกข้อความแบบทางการ"},
            {"heading": "สิ่งที่ต้องส่ง", "items": ["สรุป 5 bullet", "บันทึกข้อความฉบับปรับภาษา", "คำอธิบายว่าตรวจส่วนใดบ้าง", "หลักฐาน Prompt อย่างน้อย 2 รายการ"]},
            {"heading": "ข้อควรระวัง", "items": ["ห้ามเพิ่มข้อมูลที่ไม่มีในต้นฉบับ", "ต้องคงวันที่และตัวเลขตามไฟล์ตัวอย่าง", "ต้องปรับภาษาให้เหมาะกับงานสำนักงาน"]},
        ],
    )
    practice_1 = make_text_pdf(
        "worksheets/practice-01-data-report.pdf",
        "แบบฝึกปฏิบัติที่ 1",
        "วิเคราะห์ข้อมูลอบรมและเขียนรายงาน",
        [
            {"heading": "โจทย์", "paragraph": "ใช้ไฟล์ office-training-data.csv วิเคราะห์จำนวนผู้สมัคร รายได้ และอัตราการเข้าเรียนของแต่ละรุ่น แล้วเขียนรายงาน 1 หน้า"},
            {"heading": "Prompt แนะนำ", "paragraph": "จากตารางนี้ ช่วยสรุปแนวโน้ม 3 ข้อ ระบุรุ่นที่ควรติดตาม และเสนอแนวทางปรับปรุง 2 ข้อ โดยอ้างอิงตัวเลขจากตารางเท่านั้น"},
            {"heading": "Rubric", "table": {"widths": [470, 160, 470], "rows": [["รายการ", "คะแนน", "รายละเอียด"], ["วิเคราะห์ถูกต้อง", "30", "ใช้ตัวเลขจริงและไม่แต่งข้อมูล"], ["ข้อค้นพบชัดเจน", "25", "อธิบายแนวโน้มและปัญหา"], ["ข้อเสนอแนะใช้ได้จริง", "25", "เชื่อมโยงกับข้อมูล"], ["รูปแบบรายงาน", "20", "อ่านง่ายและมีโครงสร้าง"]]}},
        ],
    )
    final_project = make_text_pdf(
        "worksheets/final-project-office-ai-package.pdf",
        "ชิ้นงานสุดท้าย",
        "ชุดงานสำนักงานดิจิทัลด้วย AI",
        [
            {"heading": "ภารกิจ", "paragraph": "สร้างชุดงานสำนักงานสำหรับการประชาสัมพันธ์หลักสูตรระยะสั้น 1 หลักสูตร โดยใช้ AI ช่วยร่าง วิเคราะห์ และวางโครงนำเสนอ"},
            {"heading": "ไฟล์ที่ต้องส่ง", "items": ["เอกสารสรุปหลักสูตรหรือประกาศ 1 หน้า", "รายงานข้อมูลจากไฟล์ CSV 1 หน้า", "โครงสไลด์ 5-7 สไลด์", "หลักฐาน Prompt อย่างน้อย 3 รายการ", "บันทึกการตรวจและปรับแก้ผลลัพธ์ AI"]},
            {"heading": "Rubric 100 คะแนน", "table": {"widths": [460, 150, 490], "rows": [["เกณฑ์", "คะแนน", "รายละเอียด"], ["ความครบถ้วน", "25", "มีองค์ประกอบครบตามโจทย์"], ["ความถูกต้อง", "25", "ข้อมูลและตัวเลขถูกต้อง"], ["การใช้ AI อย่างเหมาะสม", "20", "Prompt ชัด ตรวจและปรับผลลัพธ์"], ["การจัดรูปแบบ", "15", "อ่านง่าย นำไปใช้ต่อได้"], ["หลักฐานและความปลอดภัย", "15", "แนบหลักฐานครบและไม่เปิดเผยข้อมูลลับ"]]}},
        ],
    )
    teacher_guide = make_text_pdf(
        "teacher/teacher-guide-and-answer-key.pdf",
        "คู่มือผู้สอนและเฉลย",
        "แนวทางจัดการเรียน ตรวจใบงาน และให้คะแนน",
        [
            {"heading": "แนวทางจัดเวลา", "items": ["ชั่วโมงที่ 1-3: ปูพื้นฐาน AI และความปลอดภัย พร้อม Pre-test", "ชั่วโมงที่ 4-6: ฝึก Prompt เอกสารและใบงาน 1-2", "ชั่วโมงที่ 7-9: วิเคราะห์ข้อมูลและแบบฝึกปฏิบัติ", "ชั่วโมงที่ 10-12: ทำชิ้นงานสุดท้าย นำเสนอ และ Post-test"]},
            {"heading": "แนวทางตรวจงาน", "items": ["ดูหลักฐาน Prompt ก่อนดูไฟล์สุดท้าย", "ตรวจว่าผู้เรียนปรับแก้ผลลัพธ์ AI ด้วยตนเอง", "หักคะแนนเมื่อพบข้อมูลส่วนบุคคลหรือข้อมูลที่ AI แต่งเพิ่ม", "ให้ feedback เป็นข้อเสนอแนะเฉพาะจุด"]},
            {"heading": "เฉลยแบบทดสอบ", "paragraph": "ไฟล์ CSV ของ Pre-test, Quiz และ Post-test มีคอลัมน์ answer และ explanation พร้อมนำเข้าระบบได้ทันที"},
        ],
    )
    return {
        "outline": outline,
        "knowledge_1": knowledge_1,
        "knowledge_2": knowledge_2,
        "knowledge_3": knowledge_3,
        "knowledge_4": knowledge_4,
        "worksheet_1": worksheet_1,
        "worksheet_2": worksheet_2,
        "practice_1": practice_1,
        "final_project": final_project,
        "teacher_guide": teacher_guide,
    }


def build_samples(pre: list[dict], quiz: list[dict], post: list[dict]) -> dict[str, str]:
    fields = ["question", "choice_a", "choice_b", "choice_c", "choice_d", "answer", "score", "explanation"]
    pre_url = write_csv_file(UPLOAD_ROOT / "assessments" / "pre-test-10-questions.csv", pre, fields)
    quiz_url = write_csv_file(UPLOAD_ROOT / "assessments" / "unit-quiz-10-questions.csv", quiz, fields)
    post_url = write_csv_file(UPLOAD_ROOT / "assessments" / "post-test-20-questions.csv", post, fields)
    sample_data = [
        {"รุ่น": "AI-01", "ผู้สมัคร": 38, "เข้าเรียน": 34, "ส่งงานครบ": 28, "รายได้": 0, "ความพึงพอใจ": 4.6},
        {"รุ่น": "AI-02", "ผู้สมัคร": 42, "เข้าเรียน": 40, "ส่งงานครบ": 35, "รายได้": 0, "ความพึงพอใจ": 4.7},
        {"รุ่น": "AI-03", "ผู้สมัคร": 31, "เข้าเรียน": 25, "ส่งงานครบ": 19, "รายได้": 0, "ความพึงพอใจ": 4.2},
        {"รุ่น": "AI-04", "ผู้สมัคร": 55, "เข้าเรียน": 51, "ส่งงานครบ": 44, "รายได้": 0, "ความพึงพอใจ": 4.8},
    ]
    data_url = write_csv_file(UPLOAD_ROOT / "samples" / "office-training-data.csv", sample_data, ["รุ่น", "ผู้สมัคร", "เข้าเรียน", "ส่งงานครบ", "รายได้", "ความพึงพอใจ"])
    prompt_url = write_text_file(
        UPLOAD_ROOT / "samples" / "prompt-template-office-ai.txt",
        """
        โครง Prompt สำหรับงานสำนักงาน

        1. บทบาท: คุณเป็น [บทบาท เช่น เจ้าหน้าที่ธุรการ/ผู้ช่วยสรุปรายงาน]
        2. งาน: ช่วย [สิ่งที่ต้องการให้ทำ]
        3. บริบท: ข้อมูลที่ใช้คือ [ข้อมูลที่ไม่เป็นความลับ]
        4. รูปแบบผลลัพธ์: ขอเป็น [bullet/table/report/email]
        5. ข้อจำกัด: ใช้ภาษา [สุภาพ/เป็นทางการ] ความยาว [จำนวนคำ/หน้า] และห้ามเพิ่มข้อมูลที่ไม่มีในต้นฉบับ

        ตัวอย่าง:
        คุณเป็นเจ้าหน้าที่ธุรการ ช่วยร่างประกาศแจ้งผู้เข้าอบรมเรื่องการเตรียมไฟล์ก่อนเรียนออนไลน์
        ใช้ภาษาสุภาพ กระชับ ไม่เกิน 150 คำ แบ่งเป็นหัวข้อ สิ่งที่ต้องเตรียม และช่องทางติดต่อ
        """,
    )
    source_doc_url = write_text_file(
        UPLOAD_ROOT / "samples" / "sample-source-document.txt",
        """
        บันทึกข้อมูลตัวอย่างสำหรับฝึกสรุป

        ศูนย์อบรมจะจัดกิจกรรมอบรมออนไลน์หัวข้อการใช้ AI ช่วยงานเอกสาร ในวันเสาร์ เวลา 09.00-12.00 น.
        ผู้เข้าอบรมควรเตรียมคอมพิวเตอร์หรือแท็บเล็ต อินเทอร์เน็ตที่เสถียร บัญชีอีเมล และไฟล์เอกสารตัวอย่างที่ไม่มีข้อมูลส่วนบุคคล
        ในการอบรมจะมีการฝึกเขียน Prompt สรุปเอกสาร ปรับภาษา และทำใบงานส่งผ่านระบบ
        ผู้เรียนที่เข้าเรียนครบ ทำแบบทดสอบหลังเรียนผ่าน และส่งชิ้นงานครบ จะได้รับใบประกาศนียบัตรจากระบบ
        """,
    )
    readme_url = write_text_file(
        UPLOAD_ROOT / "README.txt",
        """
        ชุดไฟล์หลักสูตร: การใช้ AI ช่วยงานเอกสารและงานสำนักงานดิจิทัล
        ครูเจ้าของหลักสูตร: นายธารา แสงเพ็ชร

        โฟลเดอร์ knowledge = ใบความรู้ PDF
        โฟลเดอร์ worksheets = ใบงาน/แบบฝึก PDF
        โฟลเดอร์ assessments = ข้อสอบ CSV สำหรับนำเข้า
        โฟลเดอร์ samples = ไฟล์ตัวอย่างสำหรับผู้เรียน
        โฟลเดอร์ videos = คลิปวิดีโอ MP4 แบบไม่มีเสียง มีข้อความบนหน้าจอ
        โฟลเดอร์ teacher = แผนหลักสูตร คู่มือผู้สอน และเฉลย
        """,
    )
    return {
        "pre_csv": pre_url,
        "quiz_csv": quiz_url,
        "post_csv": post_url,
        "sample_data": data_url,
        "prompt_template": prompt_url,
        "source_document": source_doc_url,
        "readme": readme_url,
    }


def draw_slide(title: str, bullets: list[str], footer: str, accent: str = PRIMARY) -> Image.Image:
    img = Image.new("RGB", (1280, 720), "#f7faf8")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 1280, 96), fill=accent)
    draw.text((56, 28), "หลักสูตร AI งานสำนักงานดิจิทัล", font=font(28, True), fill=WHITE)
    draw.text((1120, 30), "ฟรี", font=font(28, True), fill=SECONDARY)
    draw.text((58, 140), title, font=font(46, True), fill=DARK)
    y = 235
    for item in bullets:
        rounded_rect(draw, (66, y + 8, 88, y + 30), 7, SECONDARY)
        y = draw_wrapped(draw, (108, y), item, font(30), DARK, 1040, 10) + 18
    draw.line((56, 650, 1224, 650), fill="#d8e1de", width=3)
    draw.text((56, 668), footer, font=font(22), fill=MUTED)
    return img


def ffmpeg_exe() -> str | None:
    sys.path.insert(0, str(PYDEPS))
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg")


def make_video(file_stem: str, title: str, slide_sets: list[list[str]]) -> str | None:
    exe = ffmpeg_exe()
    if not exe:
        return None
    clip_dir = TMP_ROOT / "video_frames" / file_stem
    clip_dir.mkdir(parents=True, exist_ok=True)
    concat = clip_dir / "frames.txt"
    frames: list[Path] = []
    for idx, bullets in enumerate(slide_sets, start=1):
        img = draw_slide(title if idx == 1 else f"{title} ({idx})", bullets, "คำบรรยายบนหน้าจอ - ใช้ประกอบบทเรียนในระบบ")
        frame = clip_dir / f"slide-{idx:02d}.png"
        img.save(frame)
        frames.append(frame)
    with concat.open("w", encoding="utf-8") as handle:
        for frame in frames:
            handle.write(f"file '{frame.as_posix()}'\n")
            handle.write("duration 5\n")
        handle.write(f"file '{frames[-1].as_posix()}'\n")
    out = UPLOAD_ROOT / "videos" / f"{file_stem}.mp4"
    cmd = [
        exe,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat),
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        str(out),
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        fallback = cmd.copy()
        fallback[fallback.index("libx264")] = "mpeg4"
        result = subprocess.run(fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Video generation failed for {file_stem}: {result.stderr[-1000:]}", file=sys.stderr)
        return None
    return url(out)


def build_videos() -> dict[str, str]:
    videos = {
        "lesson-01-ai-overview": ("AI ช่วยงานสำนักงานอย่างไร", [["AI ช่วยร่าง สรุป จัดหมวดหมู่ และเสนอทางเลือก", "ใช้เป็นผู้ช่วย ไม่ใช่ผู้ตัดสินใจแทนมนุษย์", "ทุกผลลัพธ์ต้องตรวจทานก่อนใช้จริง"], ["งานที่เหมาะ: ร่างอีเมล สรุปรายงาน ตั้งโครงสไลด์", "งานที่ต้องระวัง: ข้อมูลส่วนบุคคล ข้อมูลลับ และการตัดสินใจสำคัญ"]]),
        "lesson-02-ai-safety": ("ความปลอดภัยข้อมูล", [["ไม่ใส่เลขบัตรประชาชน เบอร์โทร รายชื่อลูกค้า หรือไฟล์ลับ", "แทนชื่อจริงด้วยรหัส เช่น ผู้เรียน A หรือ หน่วยงาน B", "บันทึก Prompt และตรวจผลลัพธ์ก่อนส่ง"], ["Checklist: ตัดข้อมูลลับ ระบุข้อจำกัด ตรวจแหล่งอ้างอิง", "ถ้าไม่แน่ใจ ให้ใช้ข้อมูลตัวอย่างแทนข้อมูลจริง"]]),
        "lesson-03-prompt-basics": ("เขียน Prompt ให้ได้ผล", [["ใช้สูตร Role - Task - Format - Constraint", "ระบุบทบาท งาน รูปแบบผลลัพธ์ และข้อจำกัด", "เพิ่มตัวอย่างถ้าต้องการรูปแบบเฉพาะ"], ["Prompt ที่ดีทำให้แก้งานน้อยลง", "ถ้าคำตอบยังไม่ตรง ให้ปรับบริบทและข้อจำกัด"]]),
        "lesson-04-document-summary": ("สรุปและปรับภาษาเอกสาร", [["ขอ AI สรุปเป็นหัวข้อ มติ และงานที่ต้องติดตาม", "กำหนดความยาวและระดับภาษา", "ห้ามเพิ่มข้อมูลที่ไม่มีในต้นฉบับ"], ["ตรวจวันที่ ชื่อหน่วยงาน ตัวเลข และความหมาย", "ปรับสำนวนด้วยตนเองก่อนส่งงานจริง"]]),
        "lesson-05-data-analysis": ("AI กับข้อมูลตาราง", [["อธิบายความหมายคอลัมน์ก่อนให้ AI วิเคราะห์", "ถามหาแนวโน้ม จุดที่ควรติดตาม และข้อเสนอแนะ", "ห้ามให้ AI เดาตัวเลขที่ไม่มีในตาราง"], ["รายงานที่ดีต้องมีข้อค้นพบ เหตุผล และข้อจำกัด", "ใช้ไฟล์ CSV ตัวอย่างในแบบฝึก"]]),
        "lesson-06-excel-formulas": ("สูตร Excel และรายงาน", [["ให้ AI ช่วยอธิบายสูตร แต่ต้องทดสอบผลลัพธ์", "แยก input กับ calculation ให้ตรวจง่าย", "สรุปผลเป็นภาษาคน ไม่ใช่แค่ตาราง"], ["ตรวจ #REF!, #VALUE! และสูตรที่อ้างอิงผิด", "ใช้ AI ช่วยเสนอคำอธิบายกราฟหรือแนวโน้ม"]]),
        "lesson-07-slide-outline": ("วางโครงสไลด์ด้วย AI", [["ให้ AI สร้างชื่อสไลด์ ประเด็นสำคัญ และคำพูดประกอบ", "หนึ่งสไลด์ควรมีหนึ่งความคิดหลัก", "อย่าใส่ข้อความยาวเต็มหน้า"], ["ใช้ AI ช่วยจัดลำดับเรื่องราว", "ตรวจว่าข้อมูลตรงกับเอกสารและรายงาน"]]),
        "lesson-08-final-project": ("ชิ้นงานสุดท้าย", [["ส่งเอกสารสรุป รายงานข้อมูล โครงสไลด์ และหลักฐาน Prompt", "อธิบายว่าตรวจและปรับแก้ผลลัพธ์ AI อย่างไร", "ไม่มีข้อมูลส่วนบุคคลหรือข้อมูลลับ"], ["ผ่านเมื่อคะแนนรวมภาคปฏิบัติไม่น้อยกว่า 70%", "แนบไฟล์หรือลิงก์ที่เปิดได้จริง"]]),
    }
    out: dict[str, str] = {}
    for stem, (title, slides) in videos.items():
        video_url = make_video(stem, title, slides)
        if video_url:
            out[stem] = video_url
    return out


def build_manifest(paths: dict[str, str], sample_paths: dict[str, str], videos: dict[str, str], cover: str, pre: list[dict], quiz: list[dict], post: list[dict]) -> dict:
    lessons = [
        {
            "section": "AIO-01",
            "title": "รู้จัก AI สำหรับงานสำนักงาน",
            "description": "ภาพรวมการใช้ AI เป็นผู้ช่วยงานเอกสาร สรุปข้อมูล และสร้างสื่อสำนักงาน",
            "content": "ดูคลิป อ่านใบความรู้หน่วยที่ 1 แล้วทำ Pre-test เพื่อวัดพื้นฐานก่อนเรียน",
            "duration": 60,
            "video": videos.get("lesson-01-ai-overview"),
            "resources": [{"title": "ใบความรู้หน่วยที่ 1", "type": "pdf", "url": paths["knowledge_1"], "file": "unit-01-ai-basics-safety.pdf"}],
        },
        {
            "section": "AIO-01",
            "title": "ความปลอดภัยข้อมูลและจริยธรรมการใช้ AI",
            "description": "ฝึกคิดก่อนส่งข้อมูลเข้า AI และตรวจสอบผลลัพธ์อย่างรับผิดชอบ",
            "content": "ใช้ checklist ความปลอดภัยและทดลองทำข้อมูลให้ไม่ระบุตัวตน",
            "duration": 60,
            "video": videos.get("lesson-02-ai-safety"),
            "resources": [{"title": "Prompt Template สำหรับงานสำนักงาน", "type": "doc", "url": sample_paths["prompt_template"], "file": "prompt-template-office-ai.txt"}],
        },
        {
            "section": "AIO-02",
            "title": "สูตร Prompt สำหรับเอกสารสำนักงาน",
            "description": "ใช้ Role-Task-Format-Constraint เพื่อร่างอีเมล ประกาศ และบันทึกข้อความ",
            "content": "ฝึกเขียน Prompt หลายเวอร์ชันและเปรียบเทียบผลลัพธ์",
            "duration": 90,
            "video": videos.get("lesson-03-prompt-basics"),
            "resources": [{"title": "ใบความรู้หน่วยที่ 2", "type": "pdf", "url": paths["knowledge_2"], "file": "unit-02-prompt-document.pdf"}],
        },
        {
            "section": "AIO-02",
            "title": "สรุปเอกสารและปรับภาษาให้เหมาะกับผู้รับ",
            "description": "ใช้ AI สรุปเอกสารยาว ปรับระดับภาษา และตรวจข้อมูลสำคัญ",
            "content": "ใช้ไฟล์ตัวอย่างเพื่อทำใบงานสรุปเอกสารและปรับภาษา",
            "duration": 90,
            "video": videos.get("lesson-04-document-summary"),
            "resources": [{"title": "ไฟล์ข้อความตัวอย่างสำหรับสรุป", "type": "doc", "url": sample_paths["source_document"], "file": "sample-source-document.txt"}],
        },
        {
            "section": "AIO-03",
            "title": "ให้ AI ช่วยอ่านตารางและหา Insight",
            "description": "สรุปแนวโน้มจากไฟล์ CSV และเขียนข้อเสนอแนะที่อิงข้อมูล",
            "content": "ดาวน์โหลดไฟล์ข้อมูลตัวอย่างแล้วทำแบบฝึกวิเคราะห์ข้อมูล",
            "duration": 90,
            "video": videos.get("lesson-05-data-analysis"),
            "resources": [{"title": "ใบความรู้หน่วยที่ 3", "type": "pdf", "url": paths["knowledge_3"], "file": "unit-03-ai-data-report.pdf"}, {"title": "ไฟล์ข้อมูลตัวอย่าง CSV", "type": "worksheet", "url": sample_paths["sample_data"], "file": "office-training-data.csv"}],
        },
        {
            "section": "AIO-03",
            "title": "สูตร Excel เบื้องต้นและรายงาน 1 หน้า",
            "description": "ใช้ AI ช่วยอธิบายสูตร ตรวจแนวโน้ม และสร้างรายงานสำนักงาน",
            "content": "ฝึกตั้งคำถามกับข้อมูลและจัดรายงานให้หัวหน้างานอ่านง่าย",
            "duration": 90,
            "video": videos.get("lesson-06-excel-formulas"),
            "resources": [{"title": "แบบฝึกวิเคราะห์ข้อมูล", "type": "pdf", "url": paths["practice_1"], "file": "practice-01-data-report.pdf"}],
        },
        {
            "section": "AIO-04",
            "title": "วางโครงสไลด์และสื่อสำนักงานด้วย AI",
            "description": "ใช้ AI ช่วยวางโครงสไลด์ ประกาศ และข้อความประชาสัมพันธ์",
            "content": "ฝึกสร้างโครงสไลด์ 5-7 หน้าเพื่อเตรียมชิ้นงานสุดท้าย",
            "duration": 120,
            "video": videos.get("lesson-07-slide-outline"),
            "resources": [{"title": "ใบความรู้หน่วยที่ 4", "type": "pdf", "url": paths["knowledge_4"], "file": "unit-04-final-office-package.pdf"}],
        },
        {
            "section": "AIO-04",
            "title": "จัดทำชิ้นงานสุดท้ายและตรวจคุณภาพ",
            "description": "รวมเอกสาร รายงานข้อมูล โครงสไลด์ และหลักฐาน Prompt เป็นชุดส่งงาน",
            "content": "ทำชิ้นงานสุดท้าย ตรวจ checklist และทำ Post-test เพื่อจบหลักสูตร",
            "duration": 120,
            "video": videos.get("lesson-08-final-project"),
            "resources": [{"title": "โจทย์ชิ้นงานสุดท้าย", "type": "pdf", "url": paths["final_project"], "file": "final-project-office-ai-package.pdf"}],
        },
    ]
    return {
        "course": {
            "title": "การใช้ AI ช่วยงานเอกสารและงานสำนักงานดิจิทัล",
            "slug": COURSE_SLUG,
            "categorySlug": "technology",
            "categoryName": "คอมพิวเตอร์และเทคโนโลยี",
            "instructorName": "นายธารา แสงเพ็ชร",
            "shortDescription": "หลักสูตรฟรี 12 ชั่วโมง ฝึกใช้ AI ช่วยร่างเอกสาร สรุปข้อมูล วิเคราะห์ตาราง และสร้างชุดงานสำนักงานที่นำไปใช้ได้จริง",
            "description": "หลักสูตรนี้ออกแบบสำหรับผู้เริ่มต้นที่ต้องการใช้ AI ช่วยงานสำนักงานอย่างปลอดภัยและเป็นระบบ ผู้เรียนจะได้ฝึกเขียน Prompt สรุปและปรับภาษาเอกสาร วิเคราะห์ข้อมูลจากตาราง สร้างโครงสไลด์ และจัดทำชิ้นงานสุดท้ายพร้อมหลักฐานการใช้ AI",
            "coverImageUrl": cover,
            "registrationFee": 0,
            "durationMinutes": 720,
            "capacity": 100,
            "format": "online",
            "level": "beginner",
            "status": "open",
        },
        "outcomes": [
            "ใช้ AI ช่วยร่างและปรับปรุงเอกสารสำนักงานได้",
            "เขียน Prompt อย่างมีโครงสร้างและตรวจสอบผลลัพธ์ได้",
            "ใช้ AI ช่วยสรุปเอกสารและวิเคราะห์ข้อมูลตารางเบื้องต้นได้",
            "สร้างชุดงานสำนักงานดิจิทัลพร้อมหลักฐานการใช้ AI อย่างปลอดภัย",
        ],
        "requirements": [
            "มีคอมพิวเตอร์หรือแท็บเล็ตที่เชื่อมต่ออินเทอร์เน็ต",
            "มีบัญชีอีเมลและสามารถใช้งานเว็บเบราว์เซอร์พื้นฐานได้",
            "ไม่จำเป็นต้องมีพื้นฐาน AI หรือการเขียนโปรแกรม",
        ],
        "audience": [
            "เจ้าหน้าที่ธุรการ ครู บุคลากรสำนักงาน และผู้ประกอบการรายย่อย",
            "นักเรียน นักศึกษา หรือผู้สนใจเพิ่มทักษะดิจิทัล",
            "ผู้ที่ต้องการใช้ AI ช่วยลดเวลางานเอกสารและรายงาน",
        ],
        "sections": [
            {"code": "AIO-01", "title": "พื้นฐาน AI และความปลอดภัย", "description": "เข้าใจบทบาท AI ข้อจำกัด และการใช้ข้อมูลอย่างปลอดภัย", "objectives": "อธิบายงานที่ AI ช่วยได้ และใช้ checklist ความปลอดภัยก่อนส่งข้อมูลเข้า AI", "competency": "ใช้ AI อย่างรับผิดชอบและตรวจสอบผลลัพธ์ได้", "hours": 3, "sortOrder": 1},
            {"code": "AIO-02", "title": "Prompt สำหรับเอกสารและการสรุป", "description": "ฝึกเขียน Prompt เพื่อร่างเอกสาร สรุปข้อความ และปรับภาษา", "objectives": "สร้าง Prompt ที่มีบทบาท งาน รูปแบบ และข้อจำกัดชัดเจน", "competency": "ผลิตเอกสารสำนักงานจาก AI โดยมีการตรวจทาน", "hours": 3, "sortOrder": 2},
            {"code": "AIO-03", "title": "AI กับตารางข้อมูลและรายงาน", "description": "ใช้ AI ช่วยอ่านข้อมูล สรุปแนวโน้ม และเขียนรายงาน", "objectives": "วิเคราะห์ข้อมูลตัวอย่างและเขียนรายงานสั้นอิงตัวเลขจริง", "competency": "อธิบาย insight จากข้อมูลและเสนอแนวทางปรับปรุง", "hours": 3, "sortOrder": 3},
            {"code": "AIO-04", "title": "สร้างชุดงานสำนักงานดิจิทัล", "description": "วางโครงสไลด์ สร้างสื่อ และจัดทำชิ้นงานสุดท้าย", "objectives": "รวมทักษะ AI เพื่อสร้างชุดงานสำนักงานครบกระบวนการ", "competency": "ส่งมอบชิ้นงานพร้อมหลักฐาน Prompt และการตรวจคุณภาพ", "hours": 3, "sortOrder": 4},
        ],
        "lessons": lessons,
        "assessments": [
            {"key": "pre", "title": "แบบทดสอบก่อนเรียน", "type": "pre_test", "description": "วัดพื้นฐานก่อนเรียน ไม่นำคะแนนไปตัดสินผ่านหลักสูตร", "passingScore": 0, "maxAttempts": 1, "timeLimit": 15, "questionLimit": 10, "required": True, "countsTowardCompletion": False, "showAnswers": "never", "sortOrder": 1, "questions": pre, "csv": sample_paths["pre_csv"]},
            {"key": "quiz", "title": "Quiz หน่วยที่ 2: Prompt และเอกสาร", "type": "quiz", "description": "ตรวจความเข้าใจเรื่อง Prompt และการสรุปเอกสาร", "passingScore": 70, "maxAttempts": 2, "timeLimit": 20, "questionLimit": 10, "required": True, "countsTowardCompletion": True, "showAnswers": "after_close", "sortOrder": 1, "sectionCode": "AIO-02", "questions": quiz, "csv": sample_paths["quiz_csv"]},
            {"key": "post", "title": "แบบทดสอบหลังเรียน", "type": "post_test", "description": "ใช้ตัดสินผ่านหลักสูตร ต้องได้ไม่น้อยกว่า 70%", "passingScore": 70, "maxAttempts": 2, "timeLimit": 35, "questionLimit": 20, "required": True, "countsTowardCompletion": True, "showAnswers": "after_close", "sortOrder": 1, "questions": post, "csv": sample_paths["post_csv"]},
        ],
        "tasks": [
            {"type": "worksheet", "sectionCode": "AIO-02", "lessonTitle": "สูตร Prompt สำหรับเอกสารสำนักงาน", "title": "ใบงานที่ 1: ร่างเอกสารสำนักงานด้วย Prompt", "description": "ร่างอีเมลหรือประกาศจากสถานการณ์ที่กำหนดและแนบหลักฐาน Prompt", "instructionHtml": "ให้ผู้เรียนเขียน Prompt อย่างน้อย 2 เวอร์ชัน เลือกผลลัพธ์ที่เหมาะสม ปรับแก้ด้วยตนเอง และส่งไฟล์เอกสารสุดท้ายพร้อมหลักฐาน", "instructionFileUrl": paths["worksheet_1"], "instructionFileName": "worksheet-01-prompt-document.pdf", "attachmentUrl": sample_paths["prompt_template"], "attachmentFileName": "prompt-template-office-ai.txt", "attachmentTitle": "Prompt Template", "attachmentType": "doc", "maxScore": 100, "passingScore": 70, "weight": 20, "dueDays": 7, "evidenceCount": 2, "sortOrder": 1, "rubrics": [["Prompt ชัดเจน", "มีบทบาท งาน รูปแบบ และข้อจำกัด", 25], ["ภาษาเหมาะสม", "สุภาพ กระชับ ใช้ได้จริง", 25], ["การปรับแก้", "ตรวจและปรับบริบท ไม่คัดลอกดิบ", 25], ["หลักฐานครบ", "แนบ Prompt และผลลัพธ์ครบ", 25]]},
            {"type": "worksheet", "sectionCode": "AIO-02", "lessonTitle": "สรุปเอกสารและปรับภาษาให้เหมาะกับผู้รับ", "title": "ใบงานที่ 2: สรุปเอกสารและปรับภาษา", "description": "สรุปไฟล์ข้อความตัวอย่างและปรับเป็นบันทึกข้อความแบบทางการ", "instructionHtml": "ใช้ sample-source-document.txt ให้ AI ช่วยสรุปเป็น 5 bullet และปรับภาษาเป็นทางการ แล้วตรวจว่าข้อมูลไม่ถูกแต่งเพิ่ม", "instructionFileUrl": paths["worksheet_2"], "instructionFileName": "worksheet-02-summary-revision.pdf", "attachmentUrl": sample_paths["source_document"], "attachmentFileName": "sample-source-document.txt", "attachmentTitle": "ไฟล์ข้อความตัวอย่าง", "attachmentType": "doc", "maxScore": 100, "passingScore": 70, "weight": 20, "dueDays": 7, "evidenceCount": 2, "sortOrder": 2, "rubrics": [["สรุปครบ", "จับประเด็นสำคัญครบถ้วน", 30], ["ไม่แต่งข้อมูล", "คงข้อเท็จจริงจากต้นฉบับ", 25], ["ภาษาเหมาะสม", "เป็นทางการและอ่านง่าย", 25], ["หลักฐานการตรวจ", "อธิบายการตรวจและปรับแก้", 20]]},
            {"type": "practice", "sectionCode": "AIO-03", "lessonTitle": "ให้ AI ช่วยอ่านตารางและหา Insight", "title": "แบบฝึกปฏิบัติ: วิเคราะห์ข้อมูลอบรมและเขียนรายงาน", "description": "ใช้ไฟล์ CSV วิเคราะห์แนวโน้มและจัดทำรายงาน 1 หน้า", "instructionHtml": "ดาวน์โหลด office-training-data.csv แล้วใช้ AI ช่วยสรุปแนวโน้ม จุดที่ควรติดตาม และข้อเสนอแนะ โดยอ้างอิงตัวเลขจากตารางเท่านั้น", "instructionFileUrl": paths["practice_1"], "instructionFileName": "practice-01-data-report.pdf", "attachmentUrl": sample_paths["sample_data"], "attachmentFileName": "office-training-data.csv", "attachmentTitle": "ไฟล์ข้อมูลตัวอย่าง", "attachmentType": "sheet", "maxScore": 100, "passingScore": 70, "weight": 25, "dueDays": 10, "evidenceCount": 2, "sortOrder": 1, "rubrics": [["วิเคราะห์ถูกต้อง", "ใช้ตัวเลขจริงและไม่แต่งข้อมูล", 30], ["ข้อค้นพบชัดเจน", "อธิบายแนวโน้มและปัญหา", 25], ["ข้อเสนอแนะใช้ได้จริง", "เชื่อมโยงกับข้อมูล", 25], ["รูปแบบรายงาน", "อ่านง่ายและมีโครงสร้าง", 20]]},
            {"type": "practice", "sectionCode": "AIO-04", "lessonTitle": "จัดทำชิ้นงานสุดท้ายและตรวจคุณภาพ", "title": "ชิ้นงานสุดท้าย: ชุดงานสำนักงานดิจิทัลด้วย AI", "description": "ส่งเอกสารสรุป รายงานข้อมูล โครงสไลด์ และหลักฐาน Prompt", "instructionHtml": "สร้างชุดงานสำนักงานสำหรับประชาสัมพันธ์หลักสูตรระยะสั้น 1 หลักสูตร โดยใช้ AI ช่วยร่าง วิเคราะห์ และวางโครงนำเสนอ พร้อมบันทึกการตรวจและปรับแก้", "instructionFileUrl": paths["final_project"], "instructionFileName": "final-project-office-ai-package.pdf", "attachmentUrl": sample_paths["prompt_template"], "attachmentFileName": "prompt-template-office-ai.txt", "attachmentTitle": "Prompt Template", "attachmentType": "doc", "maxScore": 100, "passingScore": 70, "weight": 35, "dueDays": 14, "evidenceCount": 3, "sortOrder": 2, "rubrics": [["ความครบถ้วน", "มีเอกสาร รายงาน โครงสไลด์ และหลักฐานครบ", 25], ["ความถูกต้อง", "ข้อมูล ตัวเลข และบริบทถูกต้อง", 25], ["การใช้ AI เหมาะสม", "Prompt ชัด มีการตรวจและปรับแก้", 20], ["การนำเสนอและความปลอดภัย", "จัดรูปแบบดีและไม่เปิดเผยข้อมูลลับ", 30]]},
        ],
        "evaluationRules": [
            {"criterion": "lesson_progress", "title": "ความก้าวหน้าการเรียน", "weight": 20, "passing": 80, "required": True, "sortOrder": 1},
            {"criterion": "post_test", "title": "แบบทดสอบหลังเรียน", "weight": 30, "passing": 70, "required": True, "sortOrder": 2},
            {"criterion": "worksheet", "title": "ใบงาน", "weight": 20, "passing": 70, "required": True, "sortOrder": 3},
            {"criterion": "practice", "title": "แบบฝึกและชิ้นงานสุดท้าย", "weight": 30, "passing": 70, "required": True, "sortOrder": 4},
        ],
        "files": {**paths, **sample_paths, "cover": cover, **videos},
    }


def main() -> None:
    ensure_dirs()
    cover = make_cover()
    paths = build_pdfs()
    pre, quiz, post = make_questions()
    sample_paths = build_samples(pre, quiz, post)
    videos = build_videos()
    manifest = build_manifest(paths, sample_paths, videos, cover, pre, quiz, post)
    manifest_path = UPLOAD_ROOT / "course_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": url(manifest_path), "files": len(manifest["files"]), "videos": len(videos)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
