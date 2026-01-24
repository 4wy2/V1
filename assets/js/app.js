// ==========================================
// 1) الإعدادات والربط
// ==========================================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

document.addEventListener("DOMContentLoaded", () => {
  // تعريف العناصر بشكل صحيح
  const modal = document.getElementById("uploadModal");
  const openBtn = document.getElementById("openUploadBtn"); // الزر اللي يفتح المودال
  const closeBtn = document.getElementById("closeUploadBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");
  
  const fileInput = document.getElementById("fileInput");
  const subjectInput = document.getElementById("subjectInput");
  const noteInput = document.getElementById("noteInput");
  
  const dropZone = document.getElementById("dropZone");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const progressText = document.getElementById("progressText");
  const fileCountText = document.getElementById("fileCountText");

  // ==========================================
  // 2) منطق فتح وإغلاق المودال (الزر الرئيسي)
  // ==========================================
  if (openBtn && modal) {
    openBtn.onclick = (e) => {
      e.preventDefault();
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      document.body.style.overflow = "hidden";
    };
  }

  const closeModal = () => {
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.body.style.overflow = "auto";
    }
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeSuccessBtn) closeSuccessBtn.onclick = () => window.location.reload(); // تحديث الصفحة لرؤية النتائج

  // ==========================================
  // 3) منطق الرفع التلقائي والتراكمي
  // ==========================================
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files);
      const subject = subjectInput?.value?.trim();
      const note = noteInput?.value?.trim();

      if (!subject) {
        alert("⚠️ يرجى كتابة اسم المادة أولاً قبل اختيار الملفات.");
        fileInput.value = ""; 
        return;
      }

      if (files.length > 0) {
        if (dropZone) dropZone.classList.add("hidden");
        if (progressContainer) progressContainer.classList.remove("hidden");
        
        let completedFiles = 0;
        const totalFiles = files.length;

        const uploadPromises = files.map(async (file) => {
          const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const path = `pending/${safeName}`;

          try {
            const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
            if (upErr) throw upErr;

            const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

            await supa.from("resources").insert([{
              subject,
              note: note || null,
              file_path: path,
              file_url: pub.publicUrl,
              status: "pending"
            }]);

            completedFiles++;
            const totalPercent = Math.round((completedFiles / totalFiles) * 100);
            
            if (progressBar) progressBar.style.width = `${totalPercent}%`;
            if (progressPercent) progressPercent.textContent = `${totalPercent}%`;
            if (fileCountText) fileCountText.textContent = `تم رفع ${completedFiles} من أصل ${totalFiles} ملفات`;
            if (progressText) progressText.textContent = totalPercent < 100 ? "جاري المعالجة..." : "اكتمل الرفع!";

          } catch (err) {
            console.error("خطأ:", err);
          }
        });

        await Promise.all(uploadPromises);

        setTimeout(() => {
          document.getElementById("formContent")?.classList.add("hidden");
          document.getElementById("successUi")?.classList.remove("hidden");
        }, 800);
      }
    });
  }

  loadApprovedResources();
});

// ==========================================
// 4) جلب وعرض البيانات المعتمدة
// ==========================================
async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  const { data, error } = await supa
    .from("resources")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data) return;

  box.innerHTML = data.map(item => `
    <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 mb-3 transition-all hover:border-indigo-500/30 group">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90 group-hover:text-indigo-300 transition-colors">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/30 mt-0.5">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-lg">
        <i class="fa-solid fa-download text-xs"></i>
      </a>
    </div>
  `).join('');
}
