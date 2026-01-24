const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("uploadModal");
    const openBtn = document.getElementById("openUploadBtn");
    const closeBtn = document.getElementById("closeUploadBtn");
    const fileInput = document.getElementById("fileInput");
    const subjectInput = document.getElementById("subjectInput");
    const progressContainer = document.getElementById("progressContainer");

    // 1. فتح المودال
    if (openBtn) {
        openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            modal.classList.replace("hidden", "flex");
            document.body.style.overflow = "hidden";
        });
    }

    // 2. إغلاق المودال
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.replace("flex", "hidden");
            document.body.style.overflow = "";
        });
    }

    // 3. الرفع المتعدد لجميع أنواع الملفات
    if (fileInput) {
        fileInput.addEventListener("change", async () => {
            const files = Array.from(fileInput.files);
            const subject = subjectInput?.value.trim();

            if (!subject) {
                alert("⚠️ معليش! لازم تكتب اسم المادة أولاً عشان نعرف وين نحفظ الملفات.");
                fileInput.value = ""; 
                subjectInput.focus();
                return;
            }

            if (files.length === 0) return;

            // إخفاء منطقة السحب وإظهار شريط التحميل
            document.getElementById("dropZone")?.classList.add("hidden");
            progressContainer?.classList.remove("hidden");

            const totalSize = files.reduce((acc, f) => acc + f.size, 0);
            let uploadedSoFar = 0;

            const tasks = files.map(async (file) => {
                // استخراج الامتداد وتنظيف الاسم
                const fileExt = file.name.split('.').pop();
                const fileNameOnly = file.name.split('.').slice(0, -1).join('.');
                const safeName = `${Date.now()}-${fileNameOnly.replace(/[^\w]/gi, '_')}.${fileExt}`;
                const path = `pending/${safeName}`;

                // عملية الرفع للمخزن (Storage)
                const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                if (upErr) throw upErr;

                // الحصول على الرابط العام
                const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

                // حفظ البيانات في الجدول (Database)
                const { error: insErr } = await supa.from("resources").insert([{
                    subject,
                    file_url: pub.publicUrl,
                    file_path: path,
                    file_type: fileExt, // حفظ نوع الملف (pdf, png, docx...)
                    status: "pending"
                }]);
                
                if (insErr) throw insErr;

                // تحديث شريط التقدم
                uploadedSoFar += file.size;
                const percent = Math.round((uploadedSoFar / totalSize) * 100);
                
                document.getElementById("progressBar").style.width = `${percent}%`;
                document.getElementById("progressPercent").textContent = `${percent}%`;
                document.getElementById("fileCountText").textContent = 
                    `تم رفع ${(uploadedSoFar / (1024 * 1024)).toFixed(1)}MB من ${(totalSize / (1024 * 1024)).toFixed(1)}MB`;
            });

            try {
                await Promise.all(tasks);
                setTimeout(() => {
                    document.getElementById("formContent").classList.add("hidden");
                    document.getElementById("successUi").classList.remove("hidden");
                }, 500);
            } catch (err) {
                console.error("Upload Error:", err);
                alert("حدث خطأ أثناء الرفع. تأكد من اتصالك بالإنترنت وحاول مجدداً.");
                location.reload();
            }
        });
    }
});
