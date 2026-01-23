const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = 'pending';

// --- إدارة الدخول وفحص الصلاحيات ---
async function checkAccess() {
    const { data: { user } } = await supa.auth.getUser();

    if (!user) {
        document.getElementById('loginCard').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('whoami').textContent = "يجب تسجيل الدخول";
        return;
    }

    // فحص هل المستخدم أدمن؟
    const { data: adminData, error } = await supa
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error || !adminData) {
        alert("عذراً، هذا الحساب ليس لديه صلاحيات الإدارة.");
        document.getElementById('whoami').textContent = `مرفوض: ${user.email}`;
        return;
    }

    // إظهار اللوحة
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('whoami').textContent = `الأدمن: ${user.email}`;
    
    fetchData();
}

// --- جلب البيانات ---
async function fetchData() {
    const { data, error } = await supa
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error("Error fetching data:", error);
    
    allRows = data;
    render();
}

// --- تغيير الحالة (طلبك الأساسي) ---
window.updateStatus = async (id, status) => {
    const { error } = await supa
        .from('resources')
        .update({ status: status })
        .eq('id', id);

    if (error) {
        alert("فشل التحديث: " + error.message);
    } else {
        fetchData(); // تحديث القائمة فوراً
    }
};

window.deleteRow = async (id) => {
    if (!confirm("هل أنت متأكد من حذف السجل نهائياً؟")) return;
    const { error } = await supa.from('resources').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
};

window.setFilter = (f) => {
    currentFilter = f;
    render();
};

// --- عرض البيانات ---
function render() {
    const list = document.getElementById('listBox');
    const search = document.getElementById('searchBox').value.toLowerCase();
    
    // إحصائيات سريعة
    document.getElementById('totalCount').textContent = allRows.length;
    document.getElementById('pendingCount').textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById('approvedCount').textContent = allRows.filter(r => r.status === 'approved').length;

    const filtered = allRows.filter(r => {
        const matchesTab = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.subject.toLowerCase().includes(search);
        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-20 opacity-30">لا توجد سجلات حالياً</div>`;
        return;
    }

    list.innerHTML = filtered.map(row => `
        <div class="glass p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 border border-white/5 hover:border-white/20 transition-all">
            <div class="text-right w-full">
                <div class="flex items-center gap-3 mb-1">
                    <h3 class="font-bold text-lg text-white/90">${row.subject}</h3>
                    <span class="px-3 py-0.5 rounded-full text-[10px] font-black uppercase status-${row.status}">${row.status}</span>
                </div>
                <p class="text-sm text-white/40 font-medium">${row.note || 'لا توجد ملاحظات'}</p>
                <p class="text-[10px] opacity-20 mt-2">${new Date(row.created_at).toLocaleString('ar-SA')}</p>
            </div>
            
            <div class="flex gap-2 shrink-0">
                <a href="${row.file_url}" target="_blank" class="glass px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10">فتح</a>
                ${row.status !== 'approved' ? `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold">اعتماد</button>` : ''}
                ${row.status !== 'pending' ? `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-bold">تعليق</button>` : ''}
                <button onclick="deleteRow(${row.id})" class="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-bold">حذف</button>
            </div>
        </div>
    `).join("");
}

// --- تهيئة الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    // تسجيل الدخول
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) alert("فشل الدخول: " + error.message);
        else checkAccess();
    });

    // تسجيل الخروج
    document.getElementById('logoutBtn').onclick = async () => {
        await supa.auth.signOut();
        location.reload();
    };

    document.getElementById('searchBox').oninput = render;

    checkAccess();
});
