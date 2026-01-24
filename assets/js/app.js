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

    if (openBtn) {
        openBtn.addEventListener("click", () => {
            modal.classList.replace("hidden", "flex");
            document.body.style.overflow = "hidden";
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.replace("flex", "hidden");
            document.body.style.overflow = "";
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", async () => {
            const files = Array.from(fileInput.files);
            const subject = subjectInput?.value.trim();

            if (!subject) {
                alert("⚠️ فضلاً اكتب اسم المادة أولاً.");
                fileInput.value = ""; 
                subjectInput.focus();
                return;
            }

            if (files.length === 0) return;

            document.getElementById("dropZone")?.classList.add("hidden");
            progressContainer?.classList.remove("hidden");

            const totalSize = files.reduce((acc, f) => acc + f.size, 0);
            let uploadedSoFar = 0;

            const tasks = files.map(async (file) => {
                try {
                    // استخراج الامتداد وتنظيف الاسم (دعم العربية)
                    const fileExt = file.name.split('.').pop();
                    const safeName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const path = `pending/${safeName}`;

                    // 1. رفع الملف إلى Storage
                    const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                    if (upErr) throw new Error(`Storage: ${upErr.message}`);

                    // 2. الحصول على الرابط
                    const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

                    // 3. التسجيل في الجدول (Database)
                    const { error: insErr } = await supa.from("resources").insert([{
                        subject: subject,
                        file_url: pub.publicUrl,
                        file_path: path,
                        file_type: fileExt,
                        status: "pending"
                    }]);
                    
                    if (insErr) throw new Error(`Database: ${insErr.message}`);

                    uploadedSoFar += file.size;
                    const percent = Math.round((uploadedSoFar / totalSize) * 100);
                    document.getElementById("progressBar").style.width = `${percent}%`;
                    document.getElementById("progressPercent").textContent = `${percent}%`;

                } catch (err) {
                    console.error("Critical Error:", err.message);
                    throw err; 
                }
            });

            try {
                await Promise.all(tasks);
                setTimeout(() => {
                    document.getElementById("formContent").classList.add("hidden");
                    document.getElementById("successUi").classList.remove("hidden");
                }, 500);
            } catch (err) {
                // عرض الخطأ الحقيقي في التنبيه للمساعدة في التشخيص
                alert(`حدث خطأ: ${err.message}`);
                location.reload();
            }
        });
    }
});
