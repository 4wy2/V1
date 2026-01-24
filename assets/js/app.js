// ==========================================
// 1) الإعدادات الأساسية
// ==========================================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

// ==========================================
// 2) ربط الأحداث عند تحميل الصفحة
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // جلب العناصر
  const form = document.getElementById("eeSourceForm");
  const fileInput = document.getElementById("fileInput"); // تأكد أن هذا موجود في الـ HTML
  const submitBtn = document.getElementById("submitBtn");
  const modal = document.getElementById("uploadModal");
  const openBtn = document.getElementById("openUploadBtn");
  const closeBtn = document.getElementById("closeUploadBtn");

  // فحص سريع للأخطاء (سيظهر في الكونسول إذا فيه نقص)
  if (!form) console.error("⚠️ خطأ: نموذج eeSourceForm غير موجود");
  if (!fileInput) console.error("⚠️ خطأ: حقل fileInput غير موجود - أضف id='fileInput' لخانة الملفات");

  // منطق فتح وإغلاق المودال
  if (openBtn && modal) {
    openBtn.onclick = () => modal.classList.remove("hidden");
  }
  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.add("hidden");
  }

  // تحديث نص الملفات عند الاختيار
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const fileStatus = document.getElementById("fileStatus");
      if (fileStatus) {
        fileStatus.textContent = fileInput.files.length > 0 ? `تم اختيار ${fileInput.files.length} ملفات` : "اضغط لاختيار ملفات PDF";
      }
    });
  }

  // ==========================================
  // 3) منطق الإرسال
  // ==========================================
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const subject = form.querySelector('input[name="subject"]')?.value?.trim();
      const note = form.querySelector('input[name="note"]')?.value?.trim();
      const files = Array.from(fileInput?.files || []);

      if (!subject || files.length === 0) {
        alert("الرجاء إدخال اسم المادة واختيار ملفات PDF");
        return;
      }

      // تجهيز الواجهة للرفع
      const progressContainer = document.getElementById("progressContainer");
      const progressBar = document.getElementById("progressBar");
      const progressPercent = document.getElementById("progressPercent");

      if (submitBtn) submitBtn.classList.add("hidden");
      if (progressContainer) progressContainer.classList.remove("hidden");

      try {
        const uploadPromises = files.map(async (file, index) => {
          const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const path = `pending/${safeName}`;

          // الرفع لـ Storage
          const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
          if (upErr) throw upErr;

          // جلب الرابط
          const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

          // الحفظ في الجدول
          const { error: insErr } = await supa.from("resources").insert([{
            subject,
            note: note || null,
            file_path: path,
            file_url: pub.publicUrl,
            status: "pending"
          }]);
          if (insErr) throw insErr;

          // تحديث الشريط
          const percent = Math.round(((index + 1) / files.length) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressPercent) progressPercent.textContent = `${percent}%`;
        });

        await Promise.all(uploadPromises);

        // واجهة النجاح
        const formContent = document.getElementById("formContent");
        const successUi = document.getElementById("successUi");
        if (formContent) formContent.classList.add("hidden");
        if (successUi) successUi.classList.remove("hidden");
        form.reset();

      } catch (err) {
        console.error("Upload Error:", err);
        alert("حدث خطأ أثناء الرفع، يرجى المحاولة لاحقاً.");
        if (submitBtn) submitBtn.classList.remove("hidden");
        if (progressContainer) progressContainer.classList.add("hidden");
      }
    };
  }

  loadApprovedResources();
});

// دالة العرض (بدون تغيير كبير)
async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  const { data, error } = await supa.from("resources").select("*").eq("status", "approved").order("created_at", { ascending: false });
  if (error || !data) return;

  box.innerHTML = data.map(item => `
    <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 mb-3 transition-all hover:border-indigo-500/30">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/30">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
        <i class="fa-solid fa-download"></i>
      </a>
    </div>
  `).join('');
}
