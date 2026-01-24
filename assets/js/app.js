document.addEventListener('DOMContentLoaded', () => {
    // 1. تعريف العناصر
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const uploadModal = document.getElementById('uploadModal');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileSelectText = document.getElementById('fileSelectText');
    const form = document.getElementById('eeSourceForm');

    // 2. التحكم في السايدبار
    const openSidebar = () => {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
    };

    // 3. التحكم في المودال (الرفع)
    const openUploadModal = () => {
        uploadModal.classList.remove('hidden');
        uploadModal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    };

    const closeUploadModal = () => {
        uploadModal.classList.add('hidden');
        uploadModal.classList.remove('flex');
        document.body.style.overflow = 'auto';
        document.getElementById("formContent").classList.remove("hidden");
        document.getElementById("successUi").classList.add("hidden");
        form.reset();
        fileList.innerHTML = '';
        fileSelectText.innerText = "اضغط لاختيار ملفات PDF (متعدد)";
    };

    // 4. عرض أسماء الملفات المختارة فورياً
    fileInput.addEventListener('change', () => {
        fileList.innerHTML = '';
        const files = Array.from(fileInput.files);
        if (files.length > 0) {
            fileSelectText.innerText = `تم اختيار ${files.length} ملفات`;
            files.forEach(file => {
                const span = document.createElement('span');
                span.className = "text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md border border-indigo-500/20";
                span.innerText = file.name;
                fileList.appendChild(span);
            });
        }
    });

    // 5. إرسال الفورم (يدعم الرفع المتعدد)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerText = "جارٍ الرفع...";

        // هنا تضع كود الرفع الخاص بك (Netlify أو Supabase)
        // سنستخدم FormData لإرسال كافة الملفات
        const formData = new FormData(form);

        try {
            // محاكاة إرسال (استبدلها بـ fetch الفعلي لـ Supabase أو Netlify)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            document.getElementById("formContent").classList.add("hidden");
            document.getElementById("successUi").classList.remove("hidden");
        } catch (error) {
            alert("حدث خطأ أثناء الرفع");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "إرسال للمراجعة";
        }
    });

    // 6. ربط الأحداث بالأزرار
    document.getElementById('openSidebar').onclick = openSidebar;
    document.getElementById('closeSidebar').onclick = closeSidebar;
    document.getElementById('openUploadBtn').onclick = openUploadModal;
    document.getElementById('closeUploadBtn').onclick = closeUploadModal;
    document.getElementById('closeSuccessBtn').onclick = closeUploadModal;
    overlay.onclick = () => { closeSidebar(); closeUploadModal(); };
    
    document.onkeydown = (e) => { if (e.key === 'Escape') { closeSidebar(); closeUploadModal(); } };
});
