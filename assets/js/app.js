// ===============================
// 4) رفع ملفات متعددة + تسجيل pending في DB
// ===============================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    const subject = form.querySelector('input[name="subject"]')?.value?.trim() || "";
    const note = form.querySelector('input[name="note"]')?.value?.trim() || "";
    const fileInput = document.getElementById('fileInput');
    const files = fileInput?.files;

    // التحقق الأساسي
    if (!subject) { setSubmitLoading(false); return alert("فضلاً اكتب اسم المادة"); }
    if (!files || files.length === 0) { setSubmitLoading(false); return alert("فضلاً اختر ملفاً واحداً على الأقل"); }

    const MAX_SIZE_MB = 15; // حدد الحجم المناسب لك

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 1. التحقق من النوع والحجم
        if (file.type !== "application/pdf") throw new Error(`الملف ${file.name} ليس بصيغة PDF.`);
        if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`الملف ${file.name} حجمه كبير جداً (الأقصى ${MAX_SIZE_MB}MB).`);

        // 2. تجهيز المسار (إضافة Random String لضمان عدم تكرار الأسماء)
        const randomId = Math.random().toString(36).substring(7);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `pending/${Date.now()}_${randomId}_${safeName}`;

        // 3. رفع الملف إلى Storage
        const { error: uploadError } = await supa.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        // 4. الحصول على الرابط العام
        const { data: publicData } = supa.storage.from(BUCKET).getPublicUrl(path);

        return {
          subject,
          note: note || null,
          file_path: path,
          file_url: publicData?.publicUrl,
          status: "pending",
        };
      });

      const resourcesToInsert = await Promise.all(uploadPromises);

      // 5. إدخال البيانات للـ Database
      const { error: insertError } = await supa.from("resources").insert(resourcesToInsert);
      if (insertError) throw insertError;

      // 6. نجاح العملية وتنظيف الواجهة
      if (formContent) formContent.classList.add("hidden");
      if (successUi) successUi.classList.remove("hidden");
      
      form.reset();
      // تنظيف قائمة الملفات والرسائل التوضيحية يدوياً
      const fileList = document.getElementById('fileList');
      const fileSelectText = document.getElementById('fileSelectText');
      if (fileList) fileList.innerHTML = '';
      if (fileSelectText) fileSelectText.innerText = "اضغط لاختيار ملفات PDF";

    } catch (err) {
      console.error("Upload Error:", err);
      alert(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setSubmitLoading(false);
    }
  });
}
