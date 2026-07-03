# SPC SkillCert Online

ศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ สำหรับจัดการหลักสูตร ค่าลงทะเบียน ห้องเรียนออนไลน์ ใบงาน/แบบฝึก แบบทดสอบ วัดผล รายงาน และใบประกาศนียบัตรออนไลน์

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- MySQL/MariaDB ผ่าน XAMPP หรือเซิร์ฟเวอร์ MySQL จริง

## เริ่มใช้งานบนเครื่องพัฒนา

```bash
npm install
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

## ตั้งค่าฐานข้อมูล

1. เปิด MySQL ใน XAMPP หรือ MySQL/MariaDB บนเซิร์ฟเวอร์
2. คัดลอก `.env.example` เป็น `.env.local`
3. ตรวจค่า `DATABASE_URL`
4. รันคำสั่งติดตั้งฐานข้อมูลเมื่อเริ่มระบบใหม่

```bash
npm run db:setup
npm run db:check
```

ตัวอย่าง `.env.local`

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/spc_skillcert_online"
NEXT_PUBLIC_APP_NAME="SPC SkillCert Online"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
UPLOAD_DIR="public/uploads"
```

## คำสั่งสำคัญ

```bash
npm run lint
npm run build
npm run start
npm run db:check
npm run production:check
npm run production:harden-data
```

## Route สำคัญ

ผู้เรียน:

- `/`
- `/courses`
- `/courses/[slug]`
- `/registration`
- `/my-learning`
- `/my-certificates`
- `/verify-certificate`

ผู้ดูแลระบบ/เจ้าหน้าที่/ผู้สอน:

- `/admin/dashboard`
- `/admin/courses`
- `/admin/learning`
- `/admin/registrations`
- `/admin/payments`
- `/admin/enrollments`
- `/admin/assessments`
- `/admin/certificates`
- `/admin/reports`
- `/admin/users`
- `/admin/navigation`
- `/admin/settings`

## ขึ้นเซิร์ฟเวอร์จริง

อ่านขั้นตอนที่ [DEPLOYMENT.md](./DEPLOYMENT.md)

ก่อนเปิดระบบจริงควรรัน:

```bash
npm run lint
npm run build
npm run db:check
npm run production:check
```

ถ้า `production:check` มีรายการ `FAIL` ให้แก้ก่อนเปิดเว็บจริง

ถ้าต้องเตรียมบัญชีทดสอบ/รหัสผ่านเริ่มต้นก่อนขึ้นจริง ให้รัน:

```bash
npm run production:harden-data
```

ตรวจรายการ dry-run ให้เรียบร้อย สำรองฐานข้อมูล แล้วค่อยรันจริงด้วย:

```bash
npm run production:harden-data -- --apply
```
