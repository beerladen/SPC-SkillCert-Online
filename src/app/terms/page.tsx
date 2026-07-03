import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const terms = [
  {
    title: "1. การสมัครและการเข้าใช้งาน",
    body: "ผู้เข้าอบรมต้องใช้ข้อมูลจริงในการสมัครสมาชิก ลงทะเบียนหลักสูตร และส่งงานผ่านระบบ เพื่อให้การตรวจสอบผลการเรียนและการออกใบประกาศนียบัตรถูกต้อง",
  },
  {
    title: "2. การเรียนออนไลน์และการส่งงาน",
    body: "ผู้เข้าอบรมควรเรียนบทเรียน ทำแบบทดสอบ ใบงาน และแบบฝึกปฏิบัติตามลำดับที่หลักสูตรกำหนด การส่งไฟล์หรือหลักฐานต้องเป็นผลงานของผู้เข้าอบรมเอง",
  },
  {
    title: "3. ค่าลงทะเบียนและการตรวจหลักฐาน",
    body: "หลักสูตรที่มีค่าลงทะเบียนจะเปิดสิทธิ์ตามเงื่อนไขที่ศูนย์อบรมกำหนด หลังจากเจ้าหน้าที่ตรวจสอบหลักฐานเรียบร้อยแล้ว",
  },
  {
    title: "4. ใบประกาศนียบัตรออนไลน์",
    body: "ระบบจะออกใบประกาศนียบัตรเมื่อผู้เข้าอบรมผ่านเกณฑ์ของหลักสูตร โดยสามารถตรวจสอบความถูกต้องผ่านเลขที่ใบประกาศหรือ QR Code",
  },
  {
    title: "5. การดูแลข้อมูลส่วนบุคคล",
    body: "ข้อมูลผู้เรียนจะถูกใช้เพื่อการจัดอบรม การวัดผล การรายงาน และการออกใบประกาศนียบัตรของศูนย์อบรมเท่านั้น",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary">SPC SkillCert Online</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">เงื่อนไขการใช้บริการ</h1>
          <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
            เงื่อนไขนี้ใช้กับระบบศูนย์อบรมวิชาชีพระยะสั้นออนไลน์ การลงทะเบียน การเรียนออนไลน์
            การส่งงาน การวัดผล และการออกใบประกาศนียบัตร
          </p>
          <p className="mt-2 text-sm text-muted-foreground">ปรับปรุงล่าสุด: 1 กรกฎาคม 2569</p>
        </div>

        <Card>
          <CardContent className="grid gap-5 p-6">
            {terms.map((item) => (
              <section key={item.title}>
                <h2 className="text-lg font-bold">{item.title}</h2>
                <p className="mt-2 leading-7 text-muted-foreground">{item.body}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
