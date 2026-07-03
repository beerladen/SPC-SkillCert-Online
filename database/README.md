# ฐานข้อมูล XAMPP / MySQL

โปรเจกต์นี้ใช้ MySQL/MariaDB จาก XAMPP เป็นฐานข้อมูลหลักของระบบ SPC SkillCert Online

## วิธีติดตั้งแบบแนะนำ

1. เปิด XAMPP แล้ว Start `MySQL`
2. คัดลอก `.env.example` เป็น `.env.local`
3. ตรวจสอบค่า `DATABASE_URL`

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/spc_skillcert_online"
```

4. รันคำสั่งติดตั้งฐานข้อมูล

```bash
pnpm db:setup
```

5. ตรวจสอบข้อมูลหลังติดตั้ง

```bash
pnpm db:check
```

## ไฟล์สำคัญ

- `schema.sql` โครงสร้างฐานข้อมูลสำหรับติดตั้งใหม่
- `seed.sql` ข้อมูลตัวอย่าง บัญชีทดสอบ หลักสูตร การลงทะเบียน ใบงาน และใบประกาศ
- `migrations/2026_06_29_upgrade_learning_database.sql` อัปเกรดฐานเดิมโดยไม่ลบข้อมูล

## ตารางหลัก

- ผู้ใช้และสิทธิ์: `users`, `profiles`, `permissions`, `role_permissions`
- หลักสูตร: `categories`, `courses`, `course_sections`, `lessons`, `lesson_resources`
- โปรโมชันและส่วนลด: `promotions`, `course_promotions`
- ลงทะเบียนและค่าลงทะเบียน: `registrations`, `registration_items`, `registration_payments`, `payment_evidences`
- การเรียน: `enrollments`, `lesson_progress`
- วัดผลและใบงาน: `assessments`, `questions`, `question_options`, `assessment_attempts`, `assessment_answers`, `assignment_submissions`
- ใบประกาศ: `certificate_templates`, `certificates`, `certificate_verification_logs`
- รายงานและระบบ: `report_exports`, `site_settings`, `audit_logs`, `announcements`

## บัญชีทดสอบ

| บทบาท | อีเมล | รหัสผ่าน |
| --- | --- | --- |
| ผู้ดูแลระบบ | `admin@spc.ac.th` | `spc123456` |
| เจ้าหน้าที่ | `staff@spc.ac.th` | `spc123456` |
| ผู้สอน | `teacher1@spc.ac.th` | `spc123456` |
| ผู้เข้าอบรม | `learner@spc.ac.th` | `spc123456` |

หลังติดตั้งแล้วสามารถตรวจสถานะฐานข้อมูลได้ที่ `/admin/settings` หรือ API `/api/health/database`
