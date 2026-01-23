const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = 'pending';

// --- وظيفة التحقق من الصلاحيات ---
async function checkAccess() {
    const { data: { user } } = await supa.auth.getUser();

    if (!user) {
        document.getElementById('loginCard').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('whoami').textContent = "LOGGED OUT";
        return;
    }

    const { data: adminData } = await supa.from('admins').select('*').eq('user_id', user.id).maybeSingle();

    if (!adminData) {
        alert("ليست لديك صلاحية الوصول للإدارة!");
        document.getElementById('whoami').textContent = "ACCESS DENIED";
        return;
    }

    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('whoami').textContent = `ACTIVE: ${user.email}`;
    
    fetchData();
}

// --- جلب البيانات وتحديث الإحصائيات ---
async function fetchData() {
    const { data, error } = await supa.from('resources').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    allRows = data || [];
    render();
}

// --- تغيير الحالة (Update) ---
window.updateStatus = async (id, status) => {
    const { error } = await supa.from('resources').update({ status }).eq('id', id);
    if (error) alert(error.message);
    else fetchData();
};

// --- الحذف (Delete) ---
window.deleteRow = async (id) => {
    if (!confirm("هل أنت متأكد من الحذف النهائي؟")) return;
    const { error } = await supa.from('resources').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchData();
};

// --- الفلترة (Filter) ---
window.setFilter = (f) => {
    currentFilter = f;
    render();
};

// --- عرض البيانات (Render) ---
function render() {
    const list = document.getElementById('listBox');
    const search = document.getElementById('searchBox').value.toLowerCase();
    
    // تحديث الأعداد
    document.getElementById('totalCount').textContent = allRows.length;
    document.getElementById('pendingCount').textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById('approvedCount').textContent = allRows.filter(r => r.status === 'approved').length;

    const filtered = allRows.filter(r => {
        const matchesTab = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.subject.toLowerCase().includes(search);
        return matchesTab && matchesSearch;
    });

    list.innerHTML = filtered.map(row => `
        <div class="glass p-5 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-white/20">
            <div class="text-right w-full">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-bold text-lg">${row.subject}</h3>
                    <span class="status-${row.status} text-[9px] font-black px-2 py-0.5 rounded-full uppercase">${row.status}</span>
                </div>
                <p class="text-xs text-white/40">${row.note || 'No notes available'}</p>
            </div>
            <div class="flex gap-2 shrink-0">
                <a href="${row.file_url}" target="_blank" class="px-4 py-2 glass rounded-xl text-xs font-bold">معاينة</a>
                ${row.status === 'pending' ? `<button onclick="updateStatus(${row.id}, 'approved')" class="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">اعتماد</button>` : ''}
                ${row.status === 'approved' ? `<button onclick="updateStatus(${row.id}, 'pending')" class="px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold">تعليق</button>` : ''}
                <button onclick="deleteRow(${row.id})" class="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold">حذف</button>
            </div>
        </div>
    `).join("");
}

// --- مستمعي الأحداث ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) alert("خطأ: " + error.message);
        else checkAccess();
    });

    document.getElementById('logoutBtn').onclick = async () => {
        await supa.auth.signOut();
        location.reload();
    };

    document.getElementById('searchBox').oninput = render;

    checkAccess();
});
