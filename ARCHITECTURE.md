# Folder Structure Guidelines

โครงสร้างนี้แยกตาม **"อะไรคือ routing"** และ **"อะไรคือ logic"** เพื่อไม่ให้สับสน

```
src/
├── app/              Routes, Pages, Layouts และ API Handlers เท่านั้น (App Router)
│   ├── (auth)/       Route group สำหรับหน้า login / signup
│   ├── auth/         Route Handlers: callback, signout
│   └── dashboard/    หน้าแดชบอร์ด (Server Component)
│
├── components/
│   ├── ui/           UI ทั่วไปที่ใช้ซ้ำได้ (Alert, Modal, FormField, SubmitButton)
│   └── features/     Component เฉพาะฟีเจอร์ แยกตาม feature (auth, portfolio)
│
├── lib/              Helper / Utility ที่ไม่มี state และไม่ผูกกับ routing
│   ├── auth/         Redirect, auth guard, validation
│   ├── portfolio/    Analytics, queries, validation, formatting
│   ├── supabase/     Supabase client factory (browser / server / session)
│   └── env.ts        ตัวอ่านตัวแปรสภาพแวดล้อมที่ตรวจสอบค่าแล้ว (จุดเดียวที่อ่าน env)
│
├── server/
│   └── actions/      Server Actions ทั้งหมด ('use server')  — ไม่ใช่ route
│
├── types/            TypeScript type definitions (Database types)
└── middleware.ts     Next.js Middleware (ระบบ route รับรู้ไฟล์นี้ไฟล์เดียว)
```

## กฎที่ต้องยึด

1. **`src/app/` คือ URL tree เท่านั้น** — ทุกโฟลเดอร์ใต้ `src/app/` สร้าง URL ได้
   โฟลเดอร์ที่ไม่มี `page.tsx` / `route.ts` จะกลายเป็น URL ที่ 404 ซึ่งทำให้สับสน
   ดังนั้น **Server Actions ต้องอยู่ใน `src/server/actions/`** ไม่ใช่ใน `src/app/`

2. **`src/middleware.ts` คือไฟล์เดียวเท่านั้น** ที่ Next.js มองเห็นเป็น Middleware
   ตัวช่วยฟังก์ชันจึงชื่อ `src/lib/supabase/session.ts` ไม่ใช่ `middleware.ts`
   เพื่อไม่ให้สับสนกับ entry point ของ Next.js

3. **ใช้ `@/` alias เสมอ** (ตั้งใน `tsconfig.json` → `@/*` = `./src/*`)
   ยกเว้น import พี่น้องในโฟลเดอร์เดียวกัน ที่ใช้ `./` เพื่อความกระชับ

4. **`src/lib/` เป็น client-safe** — ห้าม import `next/headers` หรือ Supabase server client
   ถ้าต้องการข้อมูลจากฐานข้อมูล ให้อยู่ใน `src/lib/portfolio/queries.ts` และเรียกจาก
   Server Component / Server Action เท่านั้น

## หมายเหตุเรื่องเวอร์ชัน

โปรเจกต์นี้ติดตั้ง **Next.js 15** (`package.json`) แม้เอกสารจะอ้างถึง Next.js 14 —
ทั้งสองเวอร์ชันใช้ App Router แบบเดียวกัน โครงสร้างโฟลเดอร์ข้างบนจึงใช้ได้ทั้งสองแบบ
