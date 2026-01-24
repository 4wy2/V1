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

    // 1. فتح المودال (بإضافة z-index عالي وضمان التفاعل)
    if (openBtn) {
        openBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // منع تداخل الأحداث
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

    // 3. الرفع الصاروخي (Parallel Upload)
    // 3. الرفع الصاروخي مع التنبيه الذكي
    if (fileInput) {
        fileInput.addEventListener("change", async () => {
            const files = Array.from(fileInput.files);
            const subject = subjectInput?.value.trim();

            // --- التنبيه الجديد هنا ---
            if (!subject) {
                // تنبيه المستخدم
                alert("⚠️ معليش! لازم تكتب اسم المادة أولاً عشان نعرف وين نحفظ الملفات.");
                
                // تصغير وتصفيير الحقل عشان يقدر يختار مرة ثانية بعد ما يكتب
                fileInput.value = ""; 
                
                // التركيز على حقل اسم المادة تلقائياً
                subjectInput.focus();
                return;
            }
            // ------------------------

            if (files.length === 0) return;

            // إذا كل شيء تمام، يبدأ الرفع فوراً
            document.getElementById("dropZone")?.classList.add("hidden");
            progressContainer?.classList.remove("hidden");

            const totalSize = files.reduce((acc, f) => acc + f.size, 0);
            let uploadedSoFar = 0;

            const tasks = files.map(async (file) => {
                const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
                const path = `pending/${safeName}`;

                const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                if (upErr) throw upErr;

                const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

                await supa.from("resources").insert([{
                    subject,
                    file_url: pub.publicUrl,
                    file_path: path,
                    status: "pending"
                }]);

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
                }, 300);
            } catch (err) {
                console.error(err);
                alert("خطأ في الرفع، حاول مرة أخرى.");
                location.reload();
            }
        });
    }
});
