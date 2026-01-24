const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "ee-resources";

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const progressPercent = document.getElementById("progressPercent");

    if (fileInput) {
        fileInput.onchange = async () => {
            const files = Array.from(fileInput.files);
            const subject = document.getElementById("subjectInput")?.value.trim();
            
            if (!subject || files.length === 0) return;

            // إظهار واجهة التقدم فوراً
            document.getElementById("dropZone")?.classList.add("hidden");
            progressContainer?.classList.remove("hidden");

            const totalSize = files.reduce((acc, f) => acc + f.size, 0);
            let totalUploaded = 0;

            // مصفوفة الوعود للرفع المتوازي (Fast Parallel Processing)
            const uploadTasks = files.map(async (file) => {
                const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
                const path = `pending/${safeName}`;

                // رفع الملف (السرعة تعتمد على الـ Parallelism هنا)
                const { data, error } = await supa.storage.from(BUCKET).upload(path, file, {
                    cacheControl: '3600',
                    upsert: false
                });

                if (error) throw error;

                // تحديث العداد بمجرد انتهاء هذا الملف
                totalUploaded += file.size;
                const percent = Math.round((totalUploaded / totalSize) * 100);
                
                // تحديث الـ UI
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressPercent) progressPercent.textContent = `${percent}%`;

                // تسجيل البيانات (Async دون تعطيل الرفع)
                const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);
                return supa.from("resources").insert([{
                    subject,
                    file_url: pub.publicUrl,
                    file_path: path,
                    status: "pending"
                }]);
            });

            try {
                // تشغيل كل عمليات الرفع دفعة واحدة
                await Promise.all(uploadTasks);
                
                // واجهة النجاح
                setTimeout(() => {
                    document.getElementById("formContent")?.classList.add("hidden");
                    document.getElementById("successUi")?.classList.remove("hidden");
                }, 400);
            } catch (err) {
                console.error("Upload failed:", err);
                alert("فشل الرفع، تأكد من سرعة الإنترنت لديك.");
            }
        };
    }
});
