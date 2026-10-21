import { requireUser } from "@/lib/server/auth";
import { ExtensionStatus } from "./ExtensionStatus";

export const metadata = { title: "نصب افزونه" };

function Shot({ label }: { label: string }) {
  return (
    <div className="flex aspect-[16/7] items-center justify-center rounded-lg border-2 border-dashed border-border bg-row text-sm text-muted">
      تصویر: {label}
    </div>
  );
}

function Steps({ browser, url }: { browser: string; url: string }) {
  return (
    <ol className="list-decimal space-y-4 ps-5 leading-loose">
      <li>
        فایل افزونه را دانلود کنید و روی آن راست‌کلیک کرده و <b>Extract All…</b> را بزنید. پوشه <span className="ltr">price-kompass-extension</span> را در جایی ثابت نگه دارید (مثلاً «اسناد»)؛ آن را پاک نکنید.
      </li>
      <li>
        در {browser} این آدرس را در نوار آدرس بنویسید و Enter بزنید: <code className="ltr rounded bg-row px-2 py-0.5">{url}</code>
        <Shot label={`صفحه افزونه‌های ${browser}`} />
      </li>
      <li>
        گزینه <b>Developer mode</b> (حالت توسعه‌دهنده) را روشن کنید.
        <Shot label="کلید Developer mode" />
      </li>
      <li>
        روی <b>Load unpacked</b> کلیک کنید و پوشه‌ای را که از zip بیرون آوردید انتخاب کنید. داخل این پوشه باید مستقیماً فایل <span className="ltr">manifest.json</span> دیده شود (اگر پیام «Manifest file is missing» آمد، یک پوشه داخل‌تر را انتخاب کنید).
        <Shot label="دکمه Load unpacked و انتخاب پوشه" />
      </li>
      <li>
        افزونه «قیمت‌یاب» در فهرست ظاهر می‌شود. برای راحتی، آیکون آن را از منوی پازل 🧩 سنجاق (Pin) کنید.
      </li>
      <li>این صفحه را دوباره بارگذاری کنید؛ بالای صفحه باید «افزونه نصب و فعال است» نمایش داده شود.</li>
    </ol>
  );
}

export default async function ExtensionPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="card space-y-3 p-6">
        <h1 className="text-xl font-bold">افزونه قیمت‌یاب</h1>
        <p className="leading-loose text-muted">
          ترب، دیجی‌کالا، ایمالز و هوشمند درخواست‌های سرور را مسدود می‌کنند. برای همین قیمت‌ها در مرورگر خود شما خوانده می‌شود: افزونه، صفحه جستجوی همه سایت‌ها را هم‌زمان، هر کدام در یک تب پس‌زمینه باز می‌کند (فقط برای همان کالایی که جستجو کرده‌اید)، قیمت را می‌خواند، تب را می‌بندد و نتیجه هر سایت را به محض آماده شدن به قیمت‌یاب برمی‌گرداند؛ درست مثل اینکه خودتان سایت‌ها را باز کنید.
        </p>
        <ExtensionStatus />
        <div className="flex flex-wrap gap-2">
          <a href="/api/extension/download" className="btn-primary">دانلود افزونه (فایل zip)</a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">نصب در Microsoft Edge</h2>
          <Steps browser="Edge" url="edge://extensions" />
          <p className="text-sm text-muted">در Edge گزینه Developer mode در پایین ستون سمت چپ صفحه افزونه‌ها قرار دارد.</p>
        </section>
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">نصب در Google Chrome</h2>
          <Steps browser="Chrome" url="chrome://extensions" />
          <p className="text-sm text-muted">در Chrome گزینه Developer mode در گوشه بالای صفحه افزونه‌ها قرار دارد.</p>
        </section>
      </div>

      <section className="card space-y-2 p-6 text-sm leading-loose">
        <h2 className="text-lg font-bold">سؤال‌های رایج</h2>
        <p><b>به‌روزرسانی افزونه:</b> هر وقت نسخه جدید اعلام شد، فایل را دوباره دانلود و در همان پوشه جایگزین کنید، سپس در صفحه افزونه‌ها روی دکمه بارگذاری مجدد (↻) افزونه بزنید.</p>
        <p><b>پیام «Disable developer mode extensions»:</b> Edge/Chrome گاهی این پیام را نشان می‌دهند؛ روی بستن (×) بزنید، نه Disable.</p>
        <p><b>سایت «ربات نیستم» می‌خواهد:</b> یک بار آن سایت را در یک تب عادی باز کنید، تأیید را انجام دهید و دوباره «بررسی دوباره» را بزنید.</p>
        <p><b>حریم خصوصی:</b> افزونه فقط به ترب، دیجی‌کالا و ایمالز دسترسی دارد و فقط وقتی شما کالایی را در قیمت‌یاب باز می‌کنید کار می‌کند.</p>
      </section>
    </div>
  );
}
