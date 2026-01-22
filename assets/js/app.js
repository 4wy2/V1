// ===============================
// Supabase Config
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// اسم البكت (لازم يكون Private في Storage)
const BUCKET = "ee-resources";

// ===============================
// DOM
// ===============================
const overlay = document.getElementById("overlay");
const sidebar = document.getElementById("sidebar");

const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

const uploadModal = document.getElementById("uploadModal");
const openUploadBtn = document.getElementById("openUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const closeSuccessBtn = document.getElementById("closeSuccessBtn");

const formContent = document.getElementById("formContent");
const successUi = document.getElementById("successUi");
const form = document.getElementById("eeSourceForm");
const submitBtn = document.getElementById("submitBtn");

// (موجود في index، لكن بنوقفه لأن العرض صار للأدمن فقط)
const approvedResourcesBox = document.getElementById("approvedResources");

// ===============================
// UI Helpers
// ===============================
function setBodyScrollLocked(lock) {
  document.body.style.overflow = lock ? "hidden" : "auto";
}

function setSubmitLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.style.opacity = isLoading ? "0.7" : "1";
  submitBtn.textContent = isLoading ? "جارٍ الإرسال..." : "إرسال للمراجعة";
}

function resetModalUI() {
  if (formContent) formContent.classList.remove("hidden");
  if (successUi) successUi.classList.add("hidden");
  if (form) form.reset();
  setSubmitLoading(false);
}

// ===============================
// Sidebar
// ===============================
function openSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.remove("translate-x-full");
  overlay.classList.remove("hidden");
  setBodyScrollLocked(true);
}

function closeSidebar() {
  if (!sidebar || !overlay) return;
  sidebar.classList.add("translate-x-full");
  overlay.classList.add("hidden");
  setBodyScrollLocked(false);
}

if (openSidebarBtn) openSidebarBtn.addEventListener("click", openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);

// ===============================
// Modal
// ===============================
function openUploadModal() {
  if (!uploadModal) return;
  uploadModal.classList.remove("hidden");
  uploadModal.classList.add("flex");
  // نظهر overlay كذلك عشان ESC/Click يقفل
  if (overlay) overlay.classList.remove("hidden");
  setBodyScrollLocked(true);
}

function closeUploadModal() {
  if (!uploadModal) return;
  uploadModal.classList.add("hidden");
  uploadModal.classList.remove("flex");
  // نخفي overlay إذا السايدبار مقفل
  if (overlay && sidebar?.classList.contains("translate-x-full")) {
    overlay.classList.add("hidden");
  }
  setBodyScrollLocked(false);
  resetModalUI();
}

if (openUploadBtn) openUploadBtn.addEventListener("click", openUploadModal);
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadModal);
if (closeSuccessBtn) closeSuccessBtn.addEventListener("click", closeUploadModal);

// overlay click يقفل الاثنين
if (overlay) {
  overlay.addEventListener("click", () => {
    closeSidebar();
    closeUploadModal();
  });
}

// ESC يقفل
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSidebar();
    closeUploadModal();
  }
});

// ===============================
// Upload Flow (Public upload + Admin-only view)
// ===============================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    const subject = form.querySelector('input[name="subject"]')?.value?.trim();
    const note = form.querySelector('input[name="note"]')?.value?.trim();
    const fileInput = form.querySelector('input[name="file"]');
    const file = fileInput?.files?.[0];

    if (!subject) {
      setSubmitLoading(false);
      return alert("فضلاً اكتب اسم المادة");
    }
    if (!file) {
      setSubmitLoading(false);
      return alert("فضلاً اختر ملفاً");
    }

    // حالياً PDF فقط
    if (file.type !== "application/pdf") {
      setSubmitLoading(false);
      return alert("حالياً للتجربة: ارفع PDF فقط.");
    }

    try {
      // اسم ملف آمن
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `uploads/${Date.now()}_${safeName}`;

      // 1) رفع الملف إلى Storage (Bucket لازم يكون Private)
      const { error: uploadError } = await supa.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      // 2) إدخال سجل في DB (بدون file_url)
      const { error: insertError } = await supa.from("resources").insert([
        {
          subject,
          note: note || null,
          file_path: path,
        },
      ]);

      if (insertError) throw insertError;

      // نجاح
      if (formContent) formContent.classList.add("hidden");
      if (successUi) successUi.classList.remove("hidden");
      form.reset();
      setSubmitLoading(false);
    } catch (err) {
      console.error(err);
      setSubmitLoading(false);
      alert("صار خطأ أثناء الرفع/الإرسال. تأكد من صلاحيات Storage وRLS.");
    }
  });
}

// ===============================
// Disable public listing section (Admin-only system)
// ===============================
// بما أنك تبي الملفات للأدمن فقط، نخفي هذا القسم من الصفحة العامة
if (approvedResourcesBox) {
  approvedResourcesBox.innerHTML = `
    <div class="text-center text-[10px] text-white/35">
      عرض الملفات متاح للأدمن فقط.
    </div>
  `;
}
