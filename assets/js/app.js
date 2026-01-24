// ===============================
// 1) إعداد Supabase
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

// ===============================
// 2) مساعدات (Helpers)
// ===============================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (s) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
    }[s]));
}

function setSubmitLoading(isLoading, count = 0) {
    const btn = document.getElementById("submitBtn");
    if (!btn) return;
    btn.disabled = isLoading;
    btn.style.opacity = isLoading ? "0.7" : "1";
    btn.textContent = isLoading ? `جارٍ رفع ${count} ملفات...` : "إرسال للمراجعة";
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

    // دوال التحكم بالواجهة
    const toggleSidebar = (show) => {
        sidebar?.classList.toggle("translate-x-full", !show);
        overlay?.classList.toggle("hidden", !show);
        document.body.style.overflow = show ? "hidden" : "auto";
    };

    const toggleModal = (show) => {
        if (!uploadModal) return;
        uploadModal.classList.toggle("hidden", !show);
        uploadModal.classList.toggle("flex", show);
        document.body.style.overflow = show ? "hidden" : "auto";
        if (!show) {
            form?.reset();
            formContent?.classList.remove("hidden");
            successUi?.classList.add("hidden");
            setSubmitLoading(false);
        }
    };

    if (openSidebarBtn) openSidebarBtn.onclick = () => toggleSidebar(true);
    if (closeSidebarBtn) closeSidebarBtn.onclick = () => toggleSidebar(false);
    if (openUploadBtn) openUploadBtn.onclick = () => toggleModal(true);
    if (closeUploadBtn) closeUploadBtn.onclick = () => toggleModal(false);
    if (closeSuccessBtn) closeSuccessBtn.onclick = () => toggleModal(false);

    if (overlay) overlay.onclick = () => { toggleSidebar(false); toggleModal(false); };

    // ===============================
    // 4) رفع ملفات متعددة (المعدل)
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

            setSubmitLoading(true, files.length);

            let successCount = 0;

            // معالجة كل ملف على حدة
            for (const file of files) {
                if (file.type !== "application/pdf") {
                    console.warn(`تخطي ملف غير مدعوم: ${file.name}`);
                    continue;
                }

                try {
                    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
                    const path = `pending/${Date.now()}_${safeName}`;

                    // 1. الرفع لـ Storage
                    const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                    if (upErr) throw upErr;

                    // 2. جلب الرابط
                    const { data: pubData } = supa.storage.from(BUCKET).getPublicUrl(path);

                    // 3. التسجيل في قاعدة البيانات
                    const { error: insErr } = await supa.from("resources").insert([{
                        subject: files.length > 1 ? `${subject} (${file.name})` : subject,
                        note: note || null,
                        file_path: path,
                        file_url: pubData.publicUrl,
                        status: "pending",
                    }]);

                    if (insErr) throw insErr;
                    successCount++;

                } catch (err) {
                    console.error(`خطأ في رفع ${file.name}:`, err);
                }
            }

            setSubmitLoading(false);

            if (successCount > 0) {
                formContent?.classList.add("hidden");
                successUi?.classList.remove("hidden");
                form.reset();
            } else {
                alert("تعذر رفع الملفات. تأكد من أن جميع الملفات بصيغة PDF.");
            }
        });
    }

    loadApprovedResources();
});

// ===============================
// 5) تحميل المعتمد (Approved)
// ===============================
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

    if (error || !data || data.length === 0) {
        box.innerHTML = `<div class="text-center text-[10px] text-white/25">${error ? 'تعذر التحميل' : 'لا توجد مصادر حالياً'}</div>`;
        return;
    }

    box.innerHTML = data.map((item) => `
        <div class="btn-ghost rounded-2xl p-4 flex items-center justify-between gap-3">
            <div class="text-right">
                <div class="font-black text-sm text-white/80">${escapeHtml(item.subject)}</div>
                ${item.note ? `<div class="text-[10px] text-white/35 mt-1">${escapeHtml(item.note)}</div>` : ""}
            </div>
            <a class="btn-brand px-4 py-2 rounded-xl text-xs font-black"
                href="${item.file_url}" target="_blank" rel="noopener noreferrer">تحميل</a>
        </div>
    `).join("");
}
