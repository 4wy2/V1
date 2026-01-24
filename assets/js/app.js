

// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

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

function setSubmitLoading(isLoading) {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.7" : "1";
  btn.textContent = isLoading ? "جارٍ الإرسال..." : "إرسال للمراجعة";
}

// ===============================
// 3) UI وربط الأحداث بعد تحميل الصفحة
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

  function openSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.remove("translate-x-full");
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.add("translate-x-full");
    overlay.classList.add("hidden");
    document.body.style.overflow = "auto";
  }

  function openUploadModal() {
    if (!uploadModal) return;
    uploadModal.classList.remove("hidden");
    uploadModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function closeUploadModal() {
    if (!uploadModal) return;
    uploadModal.classList.add("hidden");
    uploadModal.classList.remove("flex");
    document.body.style.overflow = "auto";

    if (formContent) formContent.classList.remove("hidden");
    if (successUi) successUi.classList.add("hidden");
    if (form) form.reset();
    setSubmitLoading(false);
  }

  if (openSidebarBtn) openSidebarBtn.addEventListener("click", openSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);

  if (openUploadBtn) openUploadBtn.addEventListener("click", openUploadModal);
  if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadModal);
  if (closeSuccessBtn) closeSuccessBtn.addEventListener("click", closeUploadModal);

  if (overlay) {
    overlay.addEventListener("click", () => {
      closeSidebar();
      closeUploadModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
      closeUploadModal();
    }
  });

  // ===============================
  // 4) رفع PDF + تسجيل pending في DB
  // ===============================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setSubmitLoading(true);

      const subject = form.querySelector('input[name="subject"]')?.value?.trim() || "";
      const note = form.querySelector('input[name="note"]')?.value?.trim() || "";
      const fileInput = form.querySelector('input[name="file"]');
      const file = fileInput?.files?.[0];

      if (!subject) { setSubmitLoading(false); return alert("فضلاً اكتب اسم المادة"); }
      if (!file)    { setSubmitLoading(false); return alert("فضلاً اختر ملفاً"); }

      if (file.type !== "application/pdf") {
        setSubmitLoading(false);
        return alert("حالياً للتجربة: ارفع PDF فقط.");
      }

      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `pending/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supa
          .storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicData } = supa
          .storage
          .from(BUCKET)
          .getPublicUrl(path);

        const fileUrl = publicData?.publicUrl;
        if (!fileUrl) throw new Error("لم يتم إنشاء رابط عام. تأكد أن Bucket Public أو أن سياسات القراءة موجودة.");

        const { error: insertError } = await supa
          .from("resources")
          .insert([{
            subject,
            note: note || null,
            file_path: path,
            file_url: fileUrl,
            status: "pending",
          }]);

        if (insertError) throw insertError;

        if (formContent) formContent.classList.add("hidden");
        if (successUi) successUi.classList.remove("hidden");
        form.reset();
        setSubmitLoading(false);

      } catch (err) {
        console.error(err);
        setSubmitLoading(false);
        alert("صار خطأ أثناء الرفع/الإرسال. راجع Console للتفاصيل.");
      }
    });
  }

  // ===============================
  // 5) تحميل المعتمد فقط
  // ===============================
  loadApprovedResources();
});

async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  box.innerHTML = '<div class="text-center text-[10px] text-white/30">جاري تحميل المصادر...</div>';

  const { data, error } = await supa
    .from("resources")
    .select("id, subject, note, file_url, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    box.innerHTML = '<div class="text-center text-[10px] text-red-300/70">تعذر تحميل المصادر</div>';
    return;
  }

  if (!data || data.length === 0) {
    box.innerHTML = '<div class="text-center text-[10px] text-white/25">لا توجد مصادر معتمدة حالياً</div>';
    return;
  }

  box.innerHTML = data.map((item) => `
    <div class="btn-ghost rounded-2xl p-4 flex items-center justify-between gap-3">
      <div class="text-right">
        <div class="font-black text-sm text-white/80">${escapeHtml(item.subject)}</div>
        ${item.note ? `<div class="text-[10px] text-white/35 mt-1">${escapeHtml(item.note)}</div>` : ""}
      </div>
      <a class="btn-brand px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap"
        href="${item.file_url}" target="_blank" rel="noopener noreferrer">
        تحميل
      </a>
    </div>
  `).join("");
}
