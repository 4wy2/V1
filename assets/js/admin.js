const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allData = [];
let currentFilter = 'pending';

// تحميل البيانات
async function loadResources() {
    const { data, error } = await supa.from('resources').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);
    allData = data;
    updateStats();
    render();
}

// تحديث الإحصائيات
function updateStats() {
    document.getElementById('totalCount').textContent = allData.length;
    document.getElementById('pendingCount').textContent = allData.filter(r => r.status === 'pending').length;
    document.getElementById('approvedCount').textContent = allData.filter(r => r.status === 'approved').length;
}

// تغيير الحالة (مهم جداً)
window.updateStatus = async (id, status) => {
    const { error } = await supa.from('resources').update({ status }).eq('id', id);
    if (error) alert("فشل التحديث: " + error.message);
    else await loadResources();
};

window.deleteRow = async (id) => {
    if(!confirm("حذف نهائي؟")) return;
    await supa.from('resources').delete().eq('id', id);
    await loadResources();
};

window.setFilter = (f) => {
    currentFilter = f;
    render();
};

function render() {
    const list = document.getElementById('listBox');
    const search = document.getElementById('searchBox').value.toLowerCase();
    
    const filtered = allData.filter(r => {
        const mFilter = currentFilter === 'all' || r.status === currentFilter;
        const mSearch = r.subject.toLowerCase().includes(search);
        return mFilter && mSearch;
    });

    list.innerHTML = filtered.map(r => `
        <div class="glass p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center">
            <div class="text-right w-full">
                <h3 class="font-bold text-lg">${r.subject}</h3>
                <p class="text-white/40 text-sm">${r.note || ''}</p>
                <div class="mt-2"><span class="px-3 py-1 rounded-full text-[10px] font-bold status-${r.status}">${r.status}</span></div>
            </div>
            <div class="flex gap-2 mt-4 md:mt-0">
                <a href="${r.file_url}" target="_blank" class="px-4 py-2 glass rounded-xl text-xs">فتح</a>
                ${r.status === 'pending' ? `<button onclick="updateStatus(${r.id}, 'approved')" class="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs border border-emerald-500/30">اعتماد</button>` : ''}
                ${r.status === 'approved' ? `<button onclick="updateStatus(${r.id}, 'pending')" class="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs border border-amber-500/30">إرجاع</button>` : ''}
                <button onclick="deleteRow(${r.id})" class="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-xs border border-red-500/30">حذف</button>
            </div>
        </div>
    `).join('');
}

// البدء
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        window.location.href = 'index.html'; // أو صفحة الدخول
    } else {
        document.getElementById('whoami').textContent = `الأدمن: ${user.email}`;
        loadResources();
    }
});
