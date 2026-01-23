// admin.js - نسخة تشخيص الأعطال
console.log("برنامج الأدمن بدأ التحميل...");

const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function initAdmin() {
    console.log("جاري التحقق من المستخدم...");
    const { data: { user }, error: authError } = await supa.auth.getUser();

    if (authError || !user) {
        console.error("فشل التحقق من الجلسة:", authError);
        alert("لم يتم العثور على جلسة دخول. سيتم تحويلك لصفحة الدخول.");
        // ابحث عن السبب هنا: هل قمت بتسجيل الدخول فعلاً؟
        return;
    }

    console.log("المستخدم موجود:", user.email, "جاري فحص صلاحيات الأدمن...");
    
    // فحص جدول الأدمن
    const { data: adminData, error: adminError } = await supa
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (adminError || !adminData) {
        console.error("ليست لديك صلاحيات أدمن:", adminError);
        document.body.innerHTML = `<h1 style="color:white; text-align:center; margin-top:50px;">خطأ: هذا الحساب (${user.email}) غير مسجل في جدول الأدمن.</h1>`;
        return;
    }

    console.log("تم التأكد من الصلاحيات! عرض اللوحة...");
    // هنا نقوم بإظهار العناصر بعد التأكد التام
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('loginCard').classList.add('hidden');
    
    // ابدأ جلب البيانات
    loadResources();
}

// استدعاء الوظيفة عند التحميل
document.addEventListener('DOMContentLoaded', initAdmin);
