import csv
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF_DIR = Path(r"C:\xampp\htdocs\modulestd1\public\files\excel_pdf")
TARGET_PDF_DIR = ROOT / "public" / "files" / "excel_pdf"
ASSET_DIR = ROOT / "public" / "uploads" / "excel-office-free"
COVER_DIR = ASSET_DIR / "covers"
ASSESSMENT_DIR = ASSET_DIR / "assessments"
GENERATED_BACKGROUND = Path(
    r"C:\Users\Lenovo\.codex\generated_images\019f18de-9122-7690-bbc9-d34b0c43cde4\ig_0ef3bb750a104cf0016a43d898895481919c7068e103b69979.png"
)


WORKSHEET_TITLES = [
    "ตั้งค่าเวิร์กบุ๊ก ชีต แถว คอลัมน์ และรูปแบบเซลล์",
    "ป้อนข้อมูล จัดรูปแบบตาราง และบันทึกไฟล์อย่างเป็นระบบ",
    "ใช้สูตรพื้นฐาน บวก ลบ คูณ หาร และ AutoFill",
    "ใช้ฟังก์ชัน SUM, AVERAGE, MIN, MAX, COUNT",
    "จัดรูปแบบตัวเลข วันที่ สกุลเงิน และเปอร์เซ็นต์",
    "สร้างตารางข้อมูลรายรับรายจ่ายอย่างง่าย",
    "ใช้ Relative และ Absolute Reference ในสูตร",
    "ใช้ IF สำหรับตัดสินเงื่อนไขเบื้องต้น",
    "ใช้ COUNTIF และ SUMIF สรุปข้อมูลตามเงื่อนไข",
    "ใช้ VLOOKUP/XLOOKUP เพื่อค้นหาข้อมูล",
    "จัดเรียงข้อมูลและกรองข้อมูลด้วย Filter",
    "ใช้ Conditional Formatting เน้นข้อมูลสำคัญ",
    "สร้างกราฟแท่ง กราฟเส้น และกราฟวงกลม",
    "จัดหน้าและเตรียมพิมพ์รายงานจาก Excel",
    "สร้างตารางสรุปคะแนนหรือยอดขาย",
    "ใช้ Data Validation สร้างรายการเลือกข้อมูล",
    "ใช้ฟังก์ชันข้อความ LEFT, RIGHT, MID, CONCAT",
    "ใช้ฟังก์ชันวันที่และเวลาในงานสำนักงาน",
    "สร้าง PivotTable เพื่อสรุปข้อมูล",
    "สร้าง PivotChart จากข้อมูลสรุป",
    "สร้าง Dashboard สรุปผลด้วยกราฟและตัวชี้วัด",
    "ป้องกันชีตและกำหนดสิทธิ์การแก้ไข",
    "ตรวจสอบสูตรและแก้ไขข้อผิดพลาดในตาราง",
    "นำเข้าข้อมูลและจัดระเบียบข้อมูลก่อนวิเคราะห์",
    "สร้างแม่แบบแฟ้มงาน Excel สำหรับงานสำนักงาน",
    "เชื่อมโยงข้อมูลระหว่างชีตและสรุปผลหลายตาราง",
    "งานสอบปฏิบัติ Excel: ตารางคำนวณและสรุปผล",
    "งานสอบปฏิบัติ Excel: PivotTable และกราฟสรุป",
    "งานสอบปฏิบัติ Excel: Dashboard สำนักงาน",
    "ชิ้นงานสรุป Excel: แฟ้มข้อมูลพร้อมรายงานประเมิน",
]


QUESTIONS = [
    {
        "question": "ไฟล์งานหลักของ Microsoft Excel เรียกว่าอะไร",
        "choice_a": "เอกสาร",
        "choice_b": "เวิร์กบุ๊ก",
        "choice_c": "สไลด์",
        "choice_d": "ฐานข้อมูล",
        "answer": "ข",
        "explanation": "ไฟล์ Excel เรียกว่าเวิร์กบุ๊ก และภายในประกอบด้วยเวิร์กชีตหลายแผ่น",
    },
    {
        "question": "ตำแหน่งที่เกิดจากการตัดกันของแถวและคอลัมน์เรียกว่าอะไร",
        "choice_a": "เซลล์",
        "choice_b": "ชีต",
        "choice_c": "แท็บ",
        "choice_d": "ริบบอน",
        "answer": "ก",
        "explanation": "เซลล์คือช่องข้อมูลที่เกิดจากแถวและคอลัมน์ตัดกัน เช่น A1",
    },
    {
        "question": "การเขียนสูตรใน Excel ต้องเริ่มต้นด้วยสัญลักษณ์ใด",
        "choice_a": "#",
        "choice_b": "@",
        "choice_c": "=",
        "choice_d": "$",
        "answer": "ค",
        "explanation": "สูตรใน Excel เริ่มต้นด้วยเครื่องหมายเท่ากับ เช่น =SUM(A1:A5)",
    },
    {
        "question": "ฟังก์ชันใดใช้หาผลรวมของตัวเลข",
        "choice_a": "SUM",
        "choice_b": "COUNT",
        "choice_c": "MAX",
        "choice_d": "TEXT",
        "answer": "ก",
        "explanation": "SUM ใช้รวมค่าตัวเลขในช่วงเซลล์ที่กำหนด",
    },
    {
        "question": "ฟังก์ชัน AVERAGE ใช้สำหรับงานใด",
        "choice_a": "หาค่ามากที่สุด",
        "choice_b": "หาค่าเฉลี่ย",
        "choice_c": "นับจำนวนข้อความ",
        "choice_d": "รวมข้อความ",
        "answer": "ข",
        "explanation": "AVERAGE ใช้คำนวณค่าเฉลี่ยของข้อมูลตัวเลข",
    },
    {
        "question": "การอ้างอิงแบบ $A$1 มีความหมายอย่างไร",
        "choice_a": "อ้างอิงแบบสัมพัทธ์",
        "choice_b": "อ้างอิงแบบผสมเฉพาะแถว",
        "choice_c": "อ้างอิงแบบคงที่ทั้งคอลัมน์และแถว",
        "choice_d": "อ้างอิงไปยังชีตอื่นเท่านั้น",
        "answer": "ค",
        "explanation": "เครื่องหมาย $ ล็อกทั้งคอลัมน์ A และแถว 1 ไม่ให้เปลี่ยนเมื่อคัดลอกสูตร",
    },
    {
        "question": "เครื่องมือ AutoFill มีประโยชน์หลักในข้อใด",
        "choice_a": "เติมข้อมูลหรือคัดลอกสูตรต่อเนื่องอย่างรวดเร็ว",
        "choice_b": "ป้องกันไฟล์ด้วยรหัสผ่าน",
        "choice_c": "ลบข้อมูลซ้ำทุกแถว",
        "choice_d": "สร้างไฟล์ PDF อัตโนมัติ",
        "answer": "ก",
        "explanation": "AutoFill ช่วยลากเติมลำดับข้อมูลหรือคัดลอกสูตรไปยังเซลล์ถัดไป",
    },
    {
        "question": "หากต้องการแสดงค่า 0.25 เป็น 25% ควรใช้รูปแบบใด",
        "choice_a": "Currency",
        "choice_b": "Percentage",
        "choice_c": "Date",
        "choice_d": "Text",
        "answer": "ข",
        "explanation": "รูปแบบ Percentage ใช้แสดงค่าทศนิยมเป็นเปอร์เซ็นต์",
    },
    {
        "question": "คำสั่ง Filter ใช้เพื่ออะไร",
        "choice_a": "แสดงเฉพาะข้อมูลที่ตรงเงื่อนไข",
        "choice_b": "รวมหลายไฟล์เข้าด้วยกัน",
        "choice_c": "เปลี่ยนภาษาเมนู",
        "choice_d": "สร้างสูตรใหม่อัตโนมัติ",
        "answer": "ก",
        "explanation": "Filter ใช้กรองข้อมูลให้เห็นเฉพาะรายการที่ต้องการ",
    },
    {
        "question": "ฟังก์ชัน IF เหมาะกับงานใด",
        "choice_a": "รวมข้อมูลทุกแถว",
        "choice_b": "ตัดสินผลลัพธ์ตามเงื่อนไข",
        "choice_c": "ค้นหารูปภาพในไฟล์",
        "choice_d": "จัดหน้าเอกสาร",
        "answer": "ข",
        "explanation": "IF ใช้ตรวจเงื่อนไขแล้วคืนค่าที่ต่างกันตามผลจริงหรือเท็จ",
    },
    {
        "question": "COUNTIF ใช้สำหรับข้อใด",
        "choice_a": "นับจำนวนข้อมูลที่ตรงเงื่อนไข",
        "choice_b": "รวมข้อมูลที่ตรงเงื่อนไข",
        "choice_c": "หาค่าเฉลี่ยทั้งหมด",
        "choice_d": "ตัดข้อความด้านซ้าย",
        "answer": "ก",
        "explanation": "COUNTIF ใช้นับจำนวนเซลล์ในช่วงข้อมูลที่ตรงตามเงื่อนไข",
    },
    {
        "question": "SUMIF แตกต่างจาก SUM อย่างไร",
        "choice_a": "SUMIF รวมเฉพาะค่าที่ตรงเงื่อนไข",
        "choice_b": "SUMIF ใช้ได้กับข้อความเท่านั้น",
        "choice_c": "SUMIF ใช้สร้างกราฟ",
        "choice_d": "SUMIF ใช้ล็อกเซลล์",
        "answer": "ก",
        "explanation": "SUMIF ใช้รวมค่าตามเงื่อนไข เช่น รวมยอดขายเฉพาะแผนก",
    },
    {
        "question": "VLOOKUP หรือ XLOOKUP ใช้เพื่ออะไร",
        "choice_a": "ค้นหาและดึงข้อมูลจากตารางอ้างอิง",
        "choice_b": "จัดเรียงข้อมูลจากมากไปน้อยเท่านั้น",
        "choice_c": "สร้างหัวกระดาษ",
        "choice_d": "แปลงไฟล์เป็นรูปภาพ",
        "answer": "ก",
        "explanation": "ฟังก์ชันกลุ่ม Lookup ใช้ค้นหาค่าแล้วดึงข้อมูลที่สัมพันธ์กันกลับมา",
    },
    {
        "question": "Data Validation เหมาะกับการใช้งานใด",
        "choice_a": "จำกัดชนิดข้อมูลหรือสร้างรายการให้เลือก",
        "choice_b": "ลบสูตรทั้งหมด",
        "choice_c": "เพิ่มความสว่างหน้าจอ",
        "choice_d": "แทรกวิดีโอในชีต",
        "answer": "ก",
        "explanation": "Data Validation ช่วยควบคุมข้อมูลที่ป้อน เช่น ทำรายการเลือกแผนก",
    },
    {
        "question": "Conditional Formatting ใช้เพื่ออะไร",
        "choice_a": "จัดรูปแบบเซลล์ตามเงื่อนไข",
        "choice_b": "ส่งอีเมลจาก Excel",
        "choice_c": "เปลี่ยนชื่อไฟล์",
        "choice_d": "สำรองข้อมูลบนคลาวด์",
        "answer": "ก",
        "explanation": "Conditional Formatting ช่วยเน้นค่าที่สำคัญ เช่น ยอดต่ำกว่าเป้า",
    },
    {
        "question": "กราฟชนิดใดเหมาะกับการเปรียบเทียบยอดขายของหลายแผนก",
        "choice_a": "กราฟแท่ง",
        "choice_b": "รูปภาพ",
        "choice_c": "กล่องข้อความ",
        "choice_d": "SmartArt เท่านั้น",
        "answer": "ก",
        "explanation": "กราฟแท่งเหมาะกับการเปรียบเทียบค่าระหว่างหมวดหมู่",
    },
    {
        "question": "PivotTable เหมาะกับงานลักษณะใด",
        "choice_a": "สรุปและวิเคราะห์ข้อมูลจำนวนมากแบบยืดหยุ่น",
        "choice_b": "พิมพ์จดหมายเวียน",
        "choice_c": "วาดรูปประกอบ",
        "choice_d": "ตัดต่อวิดีโอ",
        "answer": "ก",
        "explanation": "PivotTable ใช้สรุปข้อมูลตามมิติ เช่น แผนก เดือน หรือสินค้า",
    },
    {
        "question": "ก่อนพิมพ์รายงาน Excel ควรตรวจสิ่งใด",
        "choice_a": "ขอบกระดาษ พื้นที่พิมพ์ และการจัดหน้า",
        "choice_b": "ความเร็วอินเทอร์เน็ตเท่านั้น",
        "choice_c": "สีเมาส์และคีย์บอร์ด",
        "choice_d": "ชื่อโปรแกรมอีเมล",
        "answer": "ก",
        "explanation": "Page Setup และ Print Area ช่วยให้รายงานพิมพ์ออกมาเป็นระเบียบ",
    },
    {
        "question": "การ Protect Sheet มีประโยชน์ในข้อใด",
        "choice_a": "ป้องกันการแก้ไขเซลล์สำคัญโดยไม่ตั้งใจ",
        "choice_b": "เพิ่มจำนวนแถวในชีต",
        "choice_c": "แปลงตัวเลขเป็นรูปภาพ",
        "choice_d": "ลบข้อมูลที่ซ้ำกันเสมอ",
        "answer": "ก",
        "explanation": "Protect Sheet ช่วยควบคุมส่วนที่ผู้ใช้แก้ไขได้และลดความผิดพลาด",
    },
    {
        "question": "การตั้งชื่อไฟล์ Excel ที่ดีควรเป็นอย่างไร",
        "choice_a": "สื่อความหมาย มีวันที่หรือเวอร์ชัน และค้นหาได้ง่าย",
        "choice_b": "ใช้ชื่อว่า Book1 เสมอ",
        "choice_c": "ใช้สัญลักษณ์สุ่มให้มากที่สุด",
        "choice_d": "ไม่ต้องบันทึกชื่อไฟล์",
        "answer": "ก",
        "explanation": "ชื่อไฟล์ที่ชัดเจนช่วยจัดเก็บ ส่งงาน และตรวจสอบย้อนหลังได้ง่าย",
    },
]


def font(path_name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts") / path_name,
        Path(r"C:\Windows\Fonts\tahoma.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_BOLD = font("tahomabd.ttf", 96)
FONT_TITLE = font("tahomabd.ttf", 118)
FONT_SUB = font("tahoma.ttf", 43)
FONT_BODY = font("tahoma.ttf", 34)
FONT_SMALL = font("tahoma.ttf", 27)
FONT_BADGE = font("tahomabd.ttf", 31)
FONT_BADGE_SMALL = font("tahomabd.ttf", 28)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        current = ""
        for word in paragraph.split(" "):
            candidate = word if not current else f"{current} {word}"
            if text_size(draw, candidate, fnt)[0] <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current)
            current = word
        if current:
            lines.append(current)
    return lines


def rounded_rectangle(draw: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def create_cover() -> Path:
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    out = COVER_DIR / "excel-office-cover.png"
    background_copy = COVER_DIR / "excel-office-cover-background.png"

    if GENERATED_BACKGROUND.exists():
        shutil.copy2(GENERATED_BACKGROUND, background_copy)
        image = Image.open(GENERATED_BACKGROUND).convert("RGBA")
    else:
        image = Image.new("RGBA", (1680, 945), "#f4fbf7")
        draw = ImageDraw.Draw(image)
        for x in range(image.width):
            color = int(248 - (x / image.width) * 22)
            draw.line((x, 0, x, image.height), fill=(color, 255, color + 1, 255))

    image = image.resize((1680, 945), Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Soft left reading area and bottom ribbon.
    for x in range(0, 970):
        alpha = int(238 * (1 - x / 970))
        draw.line((x, 0, x, 945), fill=(255, 255, 255, alpha))
    draw.polygon([(0, 690), (515, 945), (0, 945)], fill=(222, 243, 235, 170))
    draw.rounded_rectangle((0, 785, 1680, 945), radius=0, fill=(0, 86, 68, 224))
    draw.pieslice((1240, 710, 1810, 1120), 180, 360, fill=(0, 125, 95, 150))
    image = Image.alpha_composite(image, overlay)
    draw = ImageDraw.Draw(image)

    # Top badge.
    rounded_rectangle(draw, (50, 58, 645, 130), 36, (255, 255, 255, 235), (0, 120, 95, 255), 3)
    rounded_rectangle(draw, (58, 66, 128, 124), 26, (0, 106, 85, 255))
    draw.text((148, 76), "หลักสูตรเพื่อการพัฒนาทักษะวิชาชีพ", font=FONT_BADGE, fill=(0, 76, 63, 255))
    draw.line((82, 95, 94, 108, 113, 80), fill=(255, 255, 255, 255), width=6)

    # Excel app mark.
    rounded_rectangle(draw, (1100, 98, 1252, 250), 24, (0, 114, 68, 245))
    rounded_rectangle(draw, (1175, 76, 1322, 223), 22, (20, 155, 93, 230))
    draw.text((1145, 118), "X", font=FONT_TITLE, fill=(255, 255, 255, 255))

    # Main copy.
    draw.text((70, 175), "โปรแกรม", font=FONT_BOLD, fill=(0, 62, 72, 255))
    draw.text((70, 270), "Microsoft Excel", font=FONT_TITLE, fill=(0, 116, 71, 255))
    draw.text((70, 405), "ในสำนักงาน", font=FONT_BOLD, fill=(0, 62, 72, 255))
    draw.text((72, 512), "(Microsoft Excel for Office Work)", font=FONT_SUB, fill=(20, 32, 42, 255))

    rounded_rectangle(draw, (72, 590, 735, 655), 32, (0, 106, 85, 245))
    draw.text((112, 604), "พัฒนาทักษะตารางคำนวณอย่างมืออาชีพ", font=FONT_BADGE_SMALL, fill=(255, 255, 255, 255))

    highlights = [
        ("30 ใบงาน", "ฝึกปฏิบัติจริง"),
        ("สูตรและฟังก์ชัน", "ใช้ได้ในงานสำนักงาน"),
        ("Pivot & Dashboard", "สรุปข้อมูลเป็นรายงาน"),
    ]
    x = 70
    for title, subtitle in highlights:
        rounded_rectangle(draw, (x, 690, x + 350, 765), 18, (255, 255, 255, 235))
        draw.text((x + 24, 701), title, font=FONT_BADGE, fill=(0, 102, 80, 255))
        draw.text((x + 24, 735), subtitle, font=FONT_SMALL, fill=(26, 46, 58, 255))
        x += 380

    # Bottom feature ribbon.
    bottom_items = [
        ("เรียนรู้ง่าย", "ทำได้จริง"),
        ("เพิ่มประสิทธิภาพ", "งานข้อมูลและรายงาน"),
        ("หลักสูตรฟรี", "พร้อมแบบทดสอบก่อน-หลัง"),
    ]
    x = 92
    for index, (title, subtitle) in enumerate(bottom_items):
        if index:
            draw.line((x - 38, 825, x - 38, 905), fill=(255, 255, 255, 135), width=2)
        draw.ellipse((x, 825, x + 58, 883), outline=(255, 255, 255, 230), width=5)
        draw.text((x + 82, 812), title, font=FONT_BODY, fill=(255, 255, 255, 255))
        draw.text((x + 82, 852), subtitle, font=FONT_SMALL, fill=(221, 248, 239, 255))
        x += 450

    image.convert("RGB").save(out, quality=95)
    return out


def copy_worksheets() -> list[Path]:
    if not SOURCE_PDF_DIR.exists():
        raise FileNotFoundError(f"Source worksheet folder not found: {SOURCE_PDF_DIR}")
    TARGET_PDF_DIR.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for order in range(1, 31):
        name = f"excel_worksheet_{order:02d}.pdf"
        source = SOURCE_PDF_DIR / name
        target = TARGET_PDF_DIR / name
        if not source.exists():
            raise FileNotFoundError(f"Missing source worksheet: {source}")
        shutil.copy2(source, target)
        copied.append(target)
    return copied


def write_assessment_csv(filename: str, title: str) -> Path:
    ASSESSMENT_DIR.mkdir(parents=True, exist_ok=True)
    out = ASSESSMENT_DIR / filename
    with out.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "assessment",
                "question",
                "choice_a",
                "choice_b",
                "choice_c",
                "choice_d",
                "answer",
                "score",
                "explanation",
            ],
        )
        writer.writeheader()
        for item in QUESTIONS:
            writer.writerow({"assessment": title, **item, "score": 1})
    return out


def write_readme(cover: Path, copied: list[Path], pre_csv: Path, post_csv: Path) -> Path:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    readme = ASSET_DIR / "README.txt"
    lines = [
        "หลักสูตร: โปรแกรม Microsoft Excel ในสำนักงาน",
        "สถานะ: หลักสูตรฟรี",
        "ครูเจ้าของหลักสูตร: นายธารา แสงเพ็ชร",
        "แหล่งใบงานเดิม: C:\\xampp\\htdocs\\modulestd1\\public\\files\\excel_pdf",
        "",
        f"ภาพปก: {cover.as_posix()}",
        f"แบบทดสอบก่อนเรียน: {pre_csv.as_posix()}",
        f"แบบทดสอบหลังเรียน: {post_csv.as_posix()}",
        "",
        "ไฟล์ใบงานที่คัดลอกเข้าโปรเจค:",
    ]
    for index, target in enumerate(copied, 1):
        lines.append(f"{index:02d}. {target.as_posix()} - {WORKSHEET_TITLES[index - 1]}")
    readme.write_text("\n".join(lines), encoding="utf-8")
    return readme


def write_manifest(cover: Path, pre_csv: Path, post_csv: Path) -> Path:
    manifest = {
        "course": {
            "title": "โปรแกรม Microsoft Excel ในสำนักงาน",
            "slug": "microsoft-excel-office",
            "instructorName": "นายธารา แสงเพ็ชร",
            "registrationFee": 0,
            "durationMinutes": 1080,
            "coverImageUrl": "/uploads/excel-office-free/covers/excel-office-cover.png",
        },
        "worksheets": [
            {
                "order": index,
                "title": title,
                "fileUrl": f"/files/excel_pdf/excel_worksheet_{index:02d}.pdf",
            }
            for index, title in enumerate(WORKSHEET_TITLES, 1)
        ],
        "assessments": {
            "preTestCsv": f"/uploads/excel-office-free/assessments/{pre_csv.name}",
            "postTestCsv": f"/uploads/excel-office-free/assessments/{post_csv.name}",
        },
        "questions": QUESTIONS,
        "cover": f"/uploads/excel-office-free/covers/{cover.name}",
    }
    out = ASSET_DIR / "course_manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    copied = copy_worksheets()
    cover = create_cover()
    pre_csv = write_assessment_csv("excel-pre-test-20-questions.csv", "แบบทดสอบก่อนเรียน")
    post_csv = write_assessment_csv("excel-post-test-20-questions.csv", "แบบทดสอบหลังเรียน")
    readme = write_readme(cover, copied, pre_csv, post_csv)
    manifest = write_manifest(cover, pre_csv, post_csv)
    print(
        json.dumps(
            {
                "ok": True,
                "copiedWorksheets": len(copied),
                "cover": str(cover),
                "preTest": str(pre_csv),
                "postTest": str(post_csv),
                "readme": str(readme),
                "manifest": str(manifest),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
