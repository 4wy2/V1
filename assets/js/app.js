const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

// تحسين الأمان والعرض
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

function setSubmitLoading(isLoading, text = "إرسال للمراجعة") {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = text;
  btn.style.opacity = isLoading ? "0.6" : "1";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("eeSourceForm");
  const fileInput = document.getElementById("fileInput");
  const fileStatus = document.getElementById("fileStatus");

  // تحديث النص عند اختيار الملفات (مهم جداً للآيباد)
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const count = fileInput.files.length;
      fileStatus.textContent = count > 0 ? `تم اختيار ${count} ملفات` : "اضغط لاختيار ملفات PDF (متعدد)";
      fileStatus.classList.add("text-indigo-400");
    });
  }

  // معالجة الرفع المتوازي
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const subject = form.querySelector('input[name="subject"]')?.value?.trim();
      const note = form.querySelector('input[name="note"]')?.value?.trim();
      const files = Array.from(fileInput?.files || []);

      if (!subject || files.length === 0) return alert("تأكد من اسم المادة واختيار الملفات");

      setSubmitLoading(true, "جاري رفع الملفات معاً...");

      try {
        // تنفيذ جميع عمليات الرفع في وقت واحد (Parallel)
        const uploadPromises = files.map(async (file) => {
          if (file.type !== "application/pdf") return;

          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `pending/${Date.now()}_${safeName}`;

          // 1. رفع للمساحة التخزينية
          const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
          if (upErr) throw upErr;

          // 2. جلب الرابط العام
          const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

          // 3. التسجيل في قاعدة البيانات
          const { error: insErr } = await supa.from("resources").insert([{
            subject,
            note: note || null,
            file_path: path,
            file_url: pub.publicUrl,
            status: "pending"
          }]);
          if (insErr) throw insErr;
        });

        await Promise.all(uploadPromises);

        // إظهار واجهة النجاح
        document.getElementById("formContent").classList.add("hidden");
        document.getElementById("successUi").classList.remove("hidden");
        form.reset();
        fileStatus.textContent = "اضغط لاختيار ملفات PDF (متعدد)";

      } catch (err) {
        console.error(err);
        alert("حدث خطأ في الرفع، يرجى التحقق من جودة الاتصال.");
      } finally {
        setSubmitLoading(false);
      }
    });
  }

  // تحميل المصادر المعتمدة للعرض
  loadApprovedResources();
});

// دالة العرض (نفسها مع تحسين طفيف في الشكل)
async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  const { data, error } = await supa.from("resources").select("*").eq("status", "approved").order("created_at", { ascending: false });

  if (error) return box.innerHTML = "<p class='text-center text-xs opacity-30'>تعذر تحميل الملفات</p>";

  box.innerHTML = data.map(item => `
    <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 hover:border-indigo-500/20 transition-all mb-3">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/30">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
        <i class="fa-solid fa-arrow-down-open-pill text-xs"></i>
      </a>
    </div>
  `).join('');
}
