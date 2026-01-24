// ===============================
// 1) إعداد Supabase
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

// ===============================
// 2) مساعدات
// ===============================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[s]));
}

function setSubmitLoading(isLoading, text = "إرسال للمراجعة") {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.7" : "1";
  btn.textContent = text;
}

// ===============================
// 3) UI وربط الأحداث
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const openSidebarBtn = document.getElementById("openSidebar");
  const closeSidebarBtn = document.getElementById("closeSidebar");
  const uploadModal = document.getElementById("uploadModal");
  const openUploadBtn = document.getElementById("openUploadBtn");
  const closeUploadBtn = document.getElementById("closeUploadBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");
  const formContent = document.getElementById("formContent");
  const successUi = document.getElementById("successUi");
  const form = document.getElementById("eeSourceForm");

  // وظائف الإغلاق والفتح
  const closeAll = () => {
    sidebar?.classList.add("translate-x-full");
    overlay?.classList.add("hidden");
    uploadModal?.classList.add("hidden");
    uploadModal?.classList.remove("flex");
    document.body.style.overflow = "auto";
  };

  if (openSidebarBtn) openSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("translate-x-full");
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  });

  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeAll);
  if (openUploadBtn) openUploadBtn.addEventListener("click", () => {
    uploadModal.classList.remove("hidden");
    uploadModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  });

  if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeAll);
  if (closeSuccessBtn) closeSuccessBtn.addEventListener("click", () => {
    closeAll();
    if (formContent) formContent.classList.remove("hidden");
    if (successUi) successUi.classList.add("hidden");
  });

  if (overlay) overlay.addEventListener("click", closeAll);

  // ===============================
  // 4) رفع عدة ملفات + تسجيل في DB
  // ===============================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const subject = form.querySelector('input[name="subject"]')?.value?.trim() || "";
      const note = form.querySelector('input[name="note"]')?.value?.trim() || "";
      const fileInput = form.querySelector('input[name="file"]');
      const files = fileInput?.files;

      if (!subject) return alert("فضلاً اكتب اسم المادة");
      if (!files || files.length === 0) return alert("فضلاً اختر ملفاً واحداً على الأقل");

      setSubmitLoading(true, "جاري البدء...");

      try {
        // حلقة تكرارية لرفع كل ملف على حدة
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setSubmitLoading(true, `جاري رفع (${i + 1}/${files.length})...`);

          if (file.type !== "application/pdf") {
            console.warn(`تخطى الملف ${file.name} لأنه ليس PDF`);
            continue; 
          }

          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `pending/${Date.now()}_${safeName}`;

          // 1. الرفع للـ Storage
          const { error: uploadError } = await supa.storage
            .from(BUCKET)
            .upload(path, file);

          if (uploadError) throw uploadError;

          // 2. جلب الرابط
          const { data: publicData } = supa.storage.from(BUCKET).getPublicUrl(path);
          const fileUrl = publicData?.publicUrl;

          // 3. الإدخال في الجدول
          const { error: insertError } = await supa.from("resources").insert([{
            subject,
            note: note || null,
            file_path: path,
            file_url: fileUrl,
            status: "pending",
          }]);

          if (insertError) throw insertError;
        }

        // نجاح العملية بالكامل
        if (formContent) formContent.classList.add("hidden");
        if (successUi) successUi.classList.remove("hidden");
        form.reset();

      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء المعالجة، تأكد من اتصالك أو حجم الملفات.");
      } finally {
        setSubmitLoading(false);
      }
    });
  }

  loadApprovedResources();
});

async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;
  box.innerHTML = '<div class="text-center text-[10px] text-white/30 italic">جاري جلب المصادر...</div>';

  const { data, error } = await supa
    .from("resources")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data) {
    box.innerHTML = '<div class="text-center text-[10px] text-red-400">فشل التحميل</div>';
    return;
  }

  if (data.length === 0) {
    box.innerHTML = '<div class="text-center text-[10px] text-white/20">لا توجد ملفات حالياً</div>';
    return;
  }

  box.innerHTML = data.map(item => `
    <div class="glass flex items-center justify-between p-4 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all mb-3">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/40">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
        <i class="fa-solid fa-download text-xs"></i>
      </a>
    </div>
  `).join('');
}
