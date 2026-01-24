// ==========================================
// 1) الإعدادات الأساسية
// ==========================================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

// دالة تنظيف النص لمنع الثغرات
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

// ==========================================
// 2) ربط الأحداث عند تحميل الصفحة
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("eeSourceForm");
  const fileInput = document.getElementById("fileInput");
  const fileStatus = document.getElementById("fileStatus");
  
  // عناصر شريط التقدم
  const submitBtn = document.getElementById("submitBtn");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");

  // تحديث حالة الملفات المحددة
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const count = fileInput.files.length;
      if (count > 0) {
        fileStatus.textContent = `تم اختيار ${count} ملفات - جاهز للرفع`;
        fileStatus.classList.replace("text-white/60", "text-indigo-400");
      }
    });
  }

  // ==========================================
  // 3) منطق الرفع التفاعلي (Parallel Upload)
  // ==========================================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const subject = form.querySelector('input[name="subject"]')?.value?.trim();
      const note = form.querySelector('input[name="note"]')?.value?.trim();
      const files = Array.from(fileInput?.files || []);

      if (!subject || files.length === 0) return alert("الرجاء إدخال اسم المادة واختيار الملفات");

      // تجهيز الواجهة للرفع
      submitBtn.classList.add("hidden");
      progressContainer.classList.remove("hidden");
      
      let completedFiles = 0;
      const totalFiles = files.length;

      try {
        // فحص حجم الملفات الكلي للتنبيه
        const totalSize = files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);
        if (totalSize > 20) {
            progressText.textContent = "حجم الملفات كبير، يرجى الانتظار...";
        }

        // إطلاق عمليات الرفع بالتوازي
        const uploadPromises = files.map(async (file) => {
          if (file.type !== "application/pdf") return;

          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `pending/${Date.now()}_${safeName}`;

          // 1. رفع الملف إلى السحابة
          const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
          if (upErr) throw upErr;

          // 2. جلب الرابط المباشر
          const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

          // 3. حفظ البيانات في الجدول
          const { error: insErr } = await supa.from("resources").insert([{
            subject,
            note: note || null,
            file_path: path,
            file_url: pub.publicUrl,
            status: "pending"
          }]);
          if (insErr) throw insErr;

          // تحديث العداد والشريط بعد نجاح كل ملف
          completedFiles++;
          const percent = Math.round((completedFiles / totalFiles) * 100);
          
          progressBar.style.width = `${percent}%`;
          progressPercent.textContent = `${percent}%`;
          progressText.textContent = `تم معالجة ${completedFiles} من ${totalFiles}`;
        });

        // انتظار انتهاء الجميع
        await Promise.all(uploadPromises);

        // نجاح العملية بالكامل
        setTimeout(() => {
          document.getElementById("formContent").classList.add("hidden");
          document.getElementById("successUi").classList.remove("hidden");
          form.reset();
        }, 600);

      } catch (err) {
        console.error("Upload Error:", err);
        alert("حدث خطأ أثناء الرفع. تأكد من اتصال الإنترنت وحاول مجدداً.");
        
        // إعادة الواجهة لحالتها الأصلية للمحاولة مرة أخرى
        submitBtn.classList.remove("hidden");
        progressContainer.classList.add("hidden");
        progressBar.style.width = "0%";
      }
    });
  }

  // تحميل البيانات المعتمدة في الأسفل
  loadApprovedResources();
});

// ==========================================
// 4) دالة عرض المصادر المعتمدة
// ==========================================
async function loadApprovedResources() {
  const box = document.getElementById("approvedResources");
  if (!box) return;

  const { data, error } = await supa
    .from("resources")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = "<p class='text-center text-xs text-red-400/50'>خطأ في جلب البيانات</p>";
    return;
  }

  if (!data || data.length === 0) {
    box.innerHTML = "<p class='text-center text-xs text-white/20'>لا توجد مصادر متاحة حالياً</p>";
    return;
  }

  box.innerHTML = data.map(item => `
    <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 hover:border-indigo-500/20 transition-all mb-3 group">
      <div class="text-right">
        <h4 class="text-sm font-bold text-white/90 group-hover:text-indigo-300 transition-colors">${escapeHtml(item.subject)}</h4>
        <p class="text-[10px] text-white/30 mt-0.5">${escapeHtml(item.note || 'مصدر أكاديمي')}</p>
      </div>
      <a href="${item.file_url}" target="_blank" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-lg shadow-indigo-500/5">
        <i class="fa-solid fa-download text-xs"></i>
      </a>
    </div>
  `).join('');
}
