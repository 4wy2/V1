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
    // 1. في بداية الدالة، اجلب قيمة الملاحظة من الحقل (تأكد أن ID الحقل في الـ HTML هو noteInput)
const noteInput = document.getElementById("noteInput");
const noteValue = noteInput ? noteInput.value.trim() : "";

// ... (بقية الكود الخاص بالرفع) ...

// 2. في جزء الـ insert، أضف عمود الـ note


    if (openBtn) {
        openBtn.addEventListener("click", () => {
            modal.classList.replace("hidden", "flex");
            document.body.style.overflow = "hidden";
        });
    }
    
    
    // دالة موحدة لإغلاق المودال وإعادة ضبطه
    const closeModal = () => {
        modal.classList.replace("flex", "hidden");
        document.body.style.overflow = "";
        
        // إعادة تهيئة النموذج ليكون جاهزاً للرفع القادم
        setTimeout(() => {
            document.getElementById("formContent")?.classList.remove("hidden");
            document.getElementById("successUi")?.classList.add("hidden");
            document.getElementById("dropZone")?.classList.remove("hidden");
            document.getElementById("progressContainer")?.classList.add("hidden");
            if (fileInput) fileInput.value = ""; 
        }, 500);
    };

    // ربط الأكس (X) وزر الإغلاق بالدالة
    document.querySelectorAll("#closeUploadBtn, #closeSuccessBtn").forEach(btn => {
        btn.addEventListener("click", closeModal);
    });

    if (fileInput) {
    fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files);
        const subject = subjectInput?.value.trim();
        
        // --- الخطوة المفقودة: تعريف المتغير وجلب القيمة من الحقل ---
        const noteField = document.getElementById("noteInput");
        const noteValue = noteField ? noteField.value.trim() : ""; 

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
                const fileExt = file.name.split('.').pop();
                const safeName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const path = `pending/${safeName}`;

                // 1. رفع الملف
                const { error: upErr } = await supa.storage.from(BUCKET).upload(path, file);
                if (upErr) throw new Error(`Storage: ${upErr.message}`);

                // 2. الرابط
                const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(path);

                // 3. الإضافة للجدول (الآن noteValue معرفة وستعمل)
                const { error: insErr } = await supa.from("resources").insert([{
                    subject: subject,
                    file_url: pub.publicUrl,
                    file_path: path,
                    file_type: fileExt,
                    status: "pending",
                    note: noteValue // تم الربط بنجاح
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
                // تفريغ الحقول بعد النجاح
                if (noteField) noteField.value = "";
                if (subjectInput) subjectInput.value = "";
            }, 500);
        } catch (err) {
            alert(`حدث خطأ: ${err.message}`);
            location.reload();
        }
    });
}
    
});
