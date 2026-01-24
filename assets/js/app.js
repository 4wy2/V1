// ==========================================
// 1) الإعدادات والربط الأساسي
// ==========================================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

document.addEventListener("DOMContentLoaded", () => {
  // تعريف العناصر
  const modal = document.getElementById("uploadModal");
  const openBtn = document.getElementById("openUploadBtn");
  const closeBtn = document.getElementById("closeUploadBtn");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");
  
  const fileInput = document.getElementById("fileInput");
  const subjectInput = document.getElementById("subjectInput");
  const noteInput = document.getElementById("noteInput");
  
  const dropZone = document.getElementById("dropZone");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const fileCountText = document.getElementById("fileCountText");

  // --- التحكم في المودال ---
  if (openBtn && modal) {
    openBtn.onclick = () => {
      modal.classList.replace("hidden", "flex");
      document.body.style.overflow = "hidden";
    };
  }

  const closeModal = () => {
    modal.classList.replace("flex", "hidden");
    document.body.style.overflow = "auto";
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeSuccessBtn) closeSuccessBtn.onclick = () => window.location.reload();

  // --- ميزة السحب والإفلات (Drag & Drop) ---
  if (dropZone) {
    ['dragover', 'dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => e.preventDefault());
    });
    dropZone.ondragover = () => dropZone.classList.add('border-indigo-500', 'bg-indigo-500/5');
    dropZone.ondragleave = () => dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
    dropZone.ondrop = (e) => {
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    };
  }

  // ==========================================
  // 2) منطق الرفع (بناءً على حجم الملفات التراكمي)
  // ==========================================
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files);
      const subject = subjectInput?.value?.trim();
      const note = noteInput?.value?.trim();

      if (!subject) {
        alert("⚠️ يرجى كتابة اسم المادة أولاً.");
        fileInput.value = ""; 
        return;
      }

      if (files.length > 0) {
        dropZone.classList.add("hidden");
        progressContainer.classList.remove("hidden");

        // حساب الحجم الإجمالي لجميع الملفات المختارة
        const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
        let uploadedBytesSoFar = 0;

        const uploadPromises = files.map(async (file) => {
          const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const path = `pending/${safeName}`;

          try {
            // 1. رفع الملف
            const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
            if (upErr) throw upErr;

            // 2. جلب الرابط
            const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

            // 3. التسجيل في قاعدة البيانات
            await supa.from("resources").insert([{
              subject,
              note: note || null,
              file_path: path,
              file_url: pub.publicUrl,
              status: "pending"
            }]);

            // تحديث عداد البايتات المرفوعة
            uploadedBytesSoFar += file.size;
            
            // حساب النسبة المئوية بناءً على الحجم الكلي
            const totalPercent = Math.round((uploadedBytesSoFar / totalSizeBytes) * 100);
            
            // تحديث الواجهة
            if (progressBar) progressBar.style.width = `${totalPercent}%`;
            if (progressPercent) progressPercent.textContent = `${totalPercent}%`;
            
            const uploadedMB = (uploadedBytesSoFar / (1024 * 1024)).toFixed(1);
            const totalMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
            if (fileCountText) fileCountText.textContent = `تم معالجة ${uploadedMB}MB من أصل ${totalMB}MB`;

          } catch (err) {
            console.error("خطأ في معالجة الملف:", file.name, err);
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
// 3) جلب المصادر المعتمدة
// ==========================================
async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  const { data, error } = await supa.from("resources").select("*").eq("status", "approved").order("created_at", { ascending: false });
  if (error || !data) return;

  box.innerHTML = data.map(item => `
    <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 mb-3 group transition-all hover:border-indigo-500/30">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90 group-hover:text-indigo-300 transition-colors">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/30 mt-0.5">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
        <i class="fa-solid fa-download"></i>
      </a>
    </div>
  `).join('');
}
