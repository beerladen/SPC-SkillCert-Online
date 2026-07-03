# Production Deployment Checklist

คู่มือนี้ใช้สำหรับขึ้นระบบ `SPC SkillCert Online` บนเซิร์ฟเวอร์จริง

## 1. เตรียมฐานข้อมูล

1. สร้างฐานข้อมูล MySQL/MariaDB ชื่อที่ต้องการ เช่น `spc_skillcert_online`
2. Import schema และ migration ให้ครบ หรือย้ายฐานข้อมูลจากเครื่องทดสอบไปยังเซิร์ฟเวอร์จริง
3. ตรวจสอบว่า charset เป็น `utf8mb4`
4. ลบบัญชีทดสอบหรือปิดใช้งานบัญชีทดสอบก่อนเปิดระบบจริง

บัญชีที่ควรตรวจสอบเป็นพิเศษ:

- `admin@spc.ac.th`
- `staff@spc.ac.th`
- `teacher1@spc.ac.th`
- `teacher2@spc.ac.th`
- `teacher3@spc.ac.th`
- `learner@spc.ac.th`
- อีเมล `example.com`

## 2. ตั้งค่า Environment

ตั้งค่า `.env.local` หรือ environment variables บนเซิร์ฟเวอร์:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/spc_skillcert_online"
NEXT_PUBLIC_APP_NAME="SPC SkillCert Online"
NEXT_PUBLIC_APP_URL="https://your-real-domain.ac.th"
UPLOAD_DIR="public/uploads"
```

ห้ามใช้ `localhost` ใน `NEXT_PUBLIC_APP_URL` บนเซิร์ฟเวอร์จริง

## 3. ย้ายไฟล์อัปโหลด

ต้องย้ายโฟลเดอร์นี้ไปด้วย:

```bash
public/uploads
```

ไฟล์ในโฟลเดอร์นี้รวมภาพปกหลักสูตร ใบงาน หลักฐานส่งงาน หลักฐานค่าลงทะเบียน เทมเพลตใบประกาศ และลายเซ็นต์

## 4. ติดตั้งและ Build

```bash
npm install
npm run lint
npm run build
npm run db:check
npm run production:check
```

ถ้า `production:check` ขึ้น `FAIL` ให้แก้ก่อนเปิดเว็บจริง

ถ้าต้องเตรียมฐานข้อมูลก่อนขึ้นจริง ให้ตรวจแบบ dry-run ก่อน:

```bash
npm run production:harden-data
```

คำสั่งนี้จะแสดงบัญชีทดสอบที่ควรปิด และบัญชีที่ยังใช้รหัสผ่านเริ่มต้นเดิมอยู่ หากสำรองฐานข้อมูลแล้วและต้องการดำเนินการจริง ให้รัน:

```bash
npm run production:harden-data -- --apply
npm run production:check
```

หลังจาก harden แล้ว บัญชีที่ถูกสุ่มรหัสผ่านต้องให้ผู้ดูแลระบบรีเซ็ตรหัสผ่านใหม่ก่อนใช้งาน

## 5. Start Production

```bash
npm run start
```

แนะนำให้รันผ่าน process manager เช่น PM2:

```bash
pm2 start npm --name spc-skillcert-online -- run start
pm2 save
```

## 6. ตรวจหลังขึ้นจริง

ตรวจ URL เหล่านี้:

- `/`
- `/courses`
- `/signin`
- `/admin/dashboard`
- `/admin/settings`
- `/my-learning`
- `/my-certificates`
- `/verify-certificate`
- `/api/health/database`

## 7. งานที่ต้องทำก่อนเปิดให้ผู้ใช้จริง

- เปลี่ยนรหัสผ่านบัญชีผู้ดูแลระบบหลัก
- ปิดหรือลบบัญชีทดสอบ
- ตรวจหน้า `ตั้งค่าเว็บไซต์`
- อัปโหลดเทมเพลตใบประกาศและลายเซ็นต์จริง
- ตรวจหลักสูตรที่เปิดรับสมัครว่าถูกต้อง
- ทดลองสมัครสมาชิกด้วยอีเมลใหม่ 1 บัญชี
- ทดลองลงทะเบียนหลักสูตรฟรี 1 ครั้ง
- ทดลองลงทะเบียนหลักสูตรมีค่าลงทะเบียน 1 ครั้ง
- ทดลองออกใบประกาศและตรวจสอบเลขใบประกาศ
