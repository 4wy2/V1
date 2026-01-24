// ==========================================
// 1) الإعدادات والتحقق من المكتبة
// ==========================================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

// التحقق من وجود مكتبة Supabase قبل المحاولة
if (typeof supabase === 'undefined') {
    console.error("خطأ: مكتبة Supabase غير محملة. تأكد من إضافة سكريبت المكتبة في الـ HTML.");
}

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[s]));
}

document.addEventListener("DOMContentLoaded", () => {
    // جلب جميع العناصر والتأكد من وجودها
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

    // --- 1) وظائف المودال (الفتح والإغلاق) ---
    if (openBtn) {
        openBtn.onclick = (e) => {
            e.preventDefault();
            modal?.classList.replace("hidden", "flex");
            document.body.style.overflow = "hidden";
        };
    }

    const closeModal = () => {
        modal?.classList.replace("flex", "hidden");
        document.body.style.overflow = "auto";
    };
    if (closeBtn) closeBtn.onclick = closeModal;
    if (closeSuccessBtn) closeSuccessBtn.onclick = () => window.location.reload();

    // --- 2) منطق الرفع (تم اختباره ضد التعليق) ---
    if (fileInput) {
        fileInput.onchange = async () => {
            const files = Array.from(fileInput.files);
            const subject = subjectInput?.value?.trim();
            const note = noteInput?.value?.trim() || "";

            if (!subject) {
                alert("⚠️ يرجى كتابة اسم المادة أولاً.");
                fileInput.value = "";
                return;
            }

            if (files.length > 0) {
                // تصفير وعرض واجهة التقدم
                if (dropZone) dropZone.classList.add("hidden");
                if (progressContainer) progressContainer.classList.remove("hidden");
                if (progressBar) progressBar.style.width = "0%";

                const totalSize = files.reduce((acc, f) => acc + f.size, 0);
                let uploadedBytes = 0;

                // تنفيذ الرفع
                try {
                    // نستخدم Promise.all لضمان عدم التعليق ومعالجة كل ملف
                    const tasks = files.map(async (file) => {
                        const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
                        const path = `pending/${safeName}`;

                        // أ) الرفع للـ Storage
                        const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                        if (upErr) throw upErr;

                        // ب) جلب الرابط
                        const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

                        // ج) الحفظ في الجدول
                        const { error: insErr } = await supa.from("resources").insert([{
                            subject: subject,
                            note: note,
                            file_path: path,
                            file_url: pub.publicUrl,
                            status: "pending"
                        }]);
                        if (insErr) throw insErr;

                        // تحديث الحجم التراكمي بعد نجاح كل ملف
                        uploadedBytes += file.size;
                        const percent = Math.round((uploadedBytes / totalSize) * 100);
                        
                        // تحديث الواجهة فورياً
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (progressPercent) progressPercent.textContent = `${percent}%`;
                        if (fileCountText) {
                            fileCountText.textContent = `تم رفع ${(uploadedBytes / (1024*1024)).toFixed(1)}MB من ${(totalSize / (1024*1024)).toFixed(1)}MB`;
                        }
                    });

                    await Promise.all(tasks);

                    // نجاح تام
                    setTimeout(() => {
                        document.getElementById("formContent")?.classList.add("hidden");
                        document.getElementById("successUi")?.classList.remove("hidden");
                    }, 500);

                } catch (err) {
                    console.error("فشل الرفع:", err);
                    alert("حدث خطأ أثناء الرفع. تأكد من استقرار الإنترنت وحاول مجدداً.");
                    // إعادة الواجهة إذا فشل
                    if (dropZone) dropZone.classList.remove("hidden");
                    if (progressContainer) progressContainer.classList.add("hidden");
                }
            }
        };
    }

    loadApprovedResources();
});

// --- 3) عرض البيانات المعتمدة ---
async function loadApprovedResources() {
    const box = document.getElementById("approvedResources");
    if (!box) return;

    const { data, error } = await supa.from("resources").select("*").eq("status", "approved").order("created_at", { ascending: false });
    if (error || !data) return;

    box.innerHTML = data.map(item => `
        <div class="glass p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5 mb-3 group transition-all">
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
