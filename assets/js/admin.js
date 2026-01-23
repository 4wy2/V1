const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = 'pending';

// 1. التحقق من الدخول والصلاحيات
async function checkAuth() {
    const { data: { user } } = await supa.auth.getUser();

    if (!user) {
        document.getElementById('loginCard').classList.remove('hidden');
        document.getElementById('whoami').textContent = "يجب تسجيل الدخول";
        return;
    }

    const { data: adminData } = await supa.from('admins').select('*').eq('user_id', user.id).maybeSingle();

    if (!adminData) {
        document.getElementById('whoami').textContent = `مرفوض: الحساب ${user.email} ليس أدمن`;
        alert("ليست لديك صلاحية الوصول");
        return;
    }

    // إظهار اللوحة
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('whoami').textContent = `الأدمن المتصل: ${user.email}`;
    
    fetchData();
}

// 2. جلب البيانات من Supabase
async function fetchData() {
    const list = document.getElementById('listBox');
    list.innerHTML = `<div class="h-32 glass rounded-[2rem] loading-shimmer"></div>`;

    const { data, error } = await supa.from('resources').select('*').order('created_at', { ascending: false });

    if (error) {
        alert("خطأ في جلب البيانات: " + error.message);
        return;
    }

    allRows = data || [];
    render();
}

// 3. تغيير حالة الملف (اعتماد / تعليق)
window.updateStatus = async (id, newStatus) => {
    const { error } = await supa.from('resources').update({ status: newStatus }).eq('id', id);

    if (error) {
        alert("فشل التحديث: " + error.message);
    } else {
        // تحديث محلي سريع بدون إعادة تحميل الصفحة بالكامل
        allRows = allRows.map(r => r.id === id ? {...r, status: newStatus} : r);
        render();
    }
};

// 4. الحذف
window.deleteRow = async (id) => {
    if (!confirm("هل أنت متأكد من الحذف النهائي؟")) return;
    const { error } = await supa.from('resources').delete().eq('id', id);
    if (error) alert(error.message);
    else {
        allRows = allRows.filter(r => r.id !== id);
        render();
    }
};

// 5. الفلترة والبحث
window.setFilter = (f) => {
    currentFilter = f;
    render();
};

function render() {
    const list = document.getElementById('listBox');
    const search = document.getElementById('searchBox').value.toLowerCase();

    // تحديث الأزرار النشطة
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-white/20', 'text-cyan-400'));
    document.getElementById(`btn-${currentFilter}`).classList.add('bg-white/20', 'text-cyan-400');

    // الإحصائيات
    document.getElementById('totalCount').textContent = allRows.length;
    document.getElementById('pendingCount').textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById('approvedCount').textContent = allRows.filter(r => r.status === 'approved').length;

    const filtered = allRows.filter(r => {
        const matchesTab = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.subject.toLowerCase().includes(search) || (r.note && r.note.toLowerCase().includes(search));
        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="py-20 text-center opacity-20 font-bold">لا توجد بيانات مطابقة</div>`;
        return;
    }

    list.innerHTML = filtered.map(row => `
        <div class="glass p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-white/20 transition-all">
            <div class="text-right w-full">
                <div class="flex items-center gap-3 mb-2">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase status-${row.status}">${row.status}</span>
                    <h3 class="font-bold text-xl text-white/90">${row.subject}</h3>
                </div>
                <p class="text-white/40 text-sm leading-relaxed">${row.note || 'لا توجد ملاحظات إضافية لهذا الملف'}</p>
                <div class="flex gap-4 mt-3 opacity-20 text-[10px] font-bold">
                    <span>ID: ${row.id}</span>
                    <span>التاريخ: ${new Date(row.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
            </div>
            
            <div class="flex gap-2 w-full md:w-auto shrink-0">
                <a href="${row.file_url}" target="_blank" class="flex-1 md:flex-none text-center px-6 py-3 glass rounded-2xl text-xs font-bold hover:bg-white/10">معاينة</a>
                
                ${row.status === 'pending' ? 
                    `<button onclick="updateStatus(${row.id}, 'approved')" class="flex-1 md:flex-none px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs font-bold hover:bg-emerald-500/20">اعتماد</button>` 
                    : `<button onclick="updateStatus(${row.id}, 'pending')" class="flex-1 md:flex-none px-6 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl text-xs font-bold hover:bg-amber-500/20">تعليق</button>`
                }
                
                <button onclick="deleteRow(${row.id})" class="px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-xs font-bold hover:bg-red-500/20">🗑️</button>
            </div>
        </div>
    `).join("");
}

// 6. تشغيل النظام
document.addEventListener('DOMContentLoaded', () => {
    // فورم الدخول
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) alert("خطأ في الدخول: " + error.message);
        else checkAuth();
    });

    // الخروج
    document.getElementById('logoutBtn').onclick = async () => {
        await supa.auth.signOut();
        location.reload();
    };

    // البحث
    document.getElementById('searchBox').oninput = render;

    checkAuth();
});
