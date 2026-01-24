// ===============================
// 4) رفع ملفات متعددة + تسجيل pending في DB
// ===============================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    const subject = form.querySelector('input[name="subject"]')?.value?.trim() || "";
    const note = form.querySelector('input[name="note"]')?.value?.trim() || "";
    const fileInput = form.querySelector('input[name="file"]');
    
    // الحصول على قائمة الملفات المختارة
    const files = fileInput?.files;

    if (!subject) { setSubmitLoading(false); return alert("فضلاً اكتب اسم المادة"); }
    if (!files || files.length === 0) { setSubmitLoading(false); return alert("فضلاً اختر ملفاً واحداً على الأقل"); }

    try {
      // نستخدم Promise.all لتنفيذ عمليات الرفع بالتوازي لسرعة أكبر
      const uploadPromises = Array.from(files).map(async (file) => {
        // التحقق من نوع الملف
        if (file.type !== "application/pdf") {
          throw new Error(`الملف ${file.name} ليس بصيغة PDF.`);
        }

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `pending/${Date.now()}_${safeName}`;

        // 1. رفع الملف إلى Storage
        const { error: uploadError } = await supa
          .storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        // 2. الحصول على الرابط العام
        const { data: publicData } = supa
          .storage
          .from(BUCKET)
          .getPublicUrl(path);

        const fileUrl = publicData?.publicUrl;

        // 3. تجهيز بيانات الصف ليتم إدخالها في قاعدة البيانات
        return {
          subject,
          note: note || null,
          file_path: path,
          file_url: fileUrl,
          status: "pending",
        };
      });

      // تنفيذ جميع عمليات الرفع وانتظار النتائج
      const resourcesToInsert = await Promise.all(uploadPromises);

      // 4. إدخال جميع السجلات في Database بضربة واحدة
      const { error: insertError } = await supa
        .from("resources")
        .insert(resourcesToInsert);

      if (insertError) throw insertError;

      // نجاح العملية
      if (formContent) formContent.classList.add("hidden");
      if (successUi) successUi.classList.remove("hidden");
      form.reset();

    } catch (err) {
      console.error(err);
      alert(err.message || "صار خطأ أثناء الرفع. تأكد من الملفات وحاول مجدداً.");
    } finally {
      setSubmitLoading(false);
    }
  });
}
