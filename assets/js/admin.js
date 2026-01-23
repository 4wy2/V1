console.log("ADMIN.JS LOADED FROM V1/ASSETS/JS/ ✅");

const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = 'pending';

// وظيفة تحديث الواجهة والتحقق من الأدمن
async function refreshUI() {
    console.log("Checking User Session...");
    const { data: { user }, error: authError } = await supa.auth.getUser();

    if (authError || !user) {
        document.getElementById('loginCard').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('whoami').textContent = "يجب تسجيل الدخول";
        return;
    }

    // فحص جدول الأدمن
    const { data: adminData, error: adminError } = await supa
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (adminError || !adminData) {
        alert("هذا الحساب ليس أدمن!");
        document.getElementById('whoami').textContent = "صلاحيات مرفوضة";
        return;
    }

    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('whoami').textContent = `الأدمن: ${user.email}`;
    
    loadData();
}

async function loadData() {
    const { data, error } = await supa.from('resources').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    allRows = data || [];
    render();
}

// الدوال العامة للأزرار (تعمل فوراً)
window.updateStatus = async (id, status) => {
    await supa.from('resources').update({ status }).eq('id', id);
    loadData();
};

window.deleteRow = async (id) => {
    if(confirm("حذف؟")) {
        await supa.from('resources').delete().eq('id', id);
        loadData();
    }
};

window.setFilter = (f) => {
    currentFilter = f;
    render();
};

function render() {
    const list = document.getElementById('listBox');
    const search = document.getElementById('searchBox').value.toLowerCase();
    
    // تحديث الأرقام
    document.getElementById('totalCount').innerText = allRows.length;
    document.getElementById('pendingCount').innerText = allRows.filter(r => r.status === 'pending').length;
    document.getElementById('approvedCount').innerText = allRows.filter(r => r.status === 'approved').length;

    const filtered = allRows.filter(r => {
        const mTab = currentFilter === 'all' || r.status === currentFilter;
        const mSearch = r.subject.toLowerCase().includes(search);
        return mTab && mSearch;
    });

    list.innerHTML = filtered.map(row => `
        <div class="glass p-5 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="text-right w-full">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-bold text-lg">${row.subject}</h3>
                    <span class="status-${row.status} text-[9px] font-black px-2 py-0.5 rounded-full uppercase">${row.status}</span>
                </div>
                <p class="text-xs text-white/40">${row.note || ''}</p>
            </div>
            <div class="flex gap-2">
                <a href="${row.file_url}" target="_blank" class="px-4 py-2 glass rounded-xl text-xs">فتح</a>
                <button onclick="updateStatus(${row.id}, '${row.status === 'pending' ? 'approved' : 'pending'}')" 
                        class="px-4 py-2 rounded-xl text-xs font-bold ${row.status === 'pending' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                    ${row.status === 'pending' ? 'اعتماد' : 'تعليق'}
                </button>
                <button onclick="deleteRow(${row.id})" class="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs">حذف</button>
            </div>
        </div>
    `).join("");
}

// التشغيل
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await supa.auth.signInWithPassword({ email, password });
        refreshUI();
    });

    document.getElementById('searchBox').oninput = render;
    refreshUI();
});
