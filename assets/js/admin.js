const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = null;

// التنبيهات
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-xl mb-2 text-white font-bold transition-all ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// التحقق من المستخدم
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    currentUser = session.user;
    document.getElementById("loginCard")?.classList.add("hidden");
    document.getElementById("adminPanel")?.classList.remove("hidden");
    loadData();
}

// جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (!error) {
        allRows = data;
        render();
    }
}

// دالة الاعتماد / الحجز (تم إصلاحها تماماً)
window.updateAction = async function(e, id, type) {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "...";

    let updates = {};
    if (type === 'claim') {
        updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.email.split('@')[0] };
    } else if (type === 'approve') {
        updates = { status: 'approved' };
    } else if (type === 'release') {
        updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    }

    // التعديل الجوهري: استخدام تحديث بسيط ومباشر
    const { error } = await supa.from("resources").update(updates).eq("id", id);

    if (error) {
        showToast("فشل: " + error.message, "error");
        btn.innerHTML = original;
        btn.disabled = false;
    } else {
        showToast("تمت العملية", "success");
        loadData(); // تحديث القائمة
    }
};

// رسم الجدول
function render() {
    const desktop = document.getElementById("desktopList");
    const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
    
    const filtered = allRows.filter(r => 
        (currentFilter === "all" || r.status === currentFilter) && 
        (r.subject || "").toLowerCase().includes(search)
    );

    document.getElementById("totalCount").textContent = filtered.length;

    desktop.innerHTML = filtered.map(row => {
        const isMe = row.processed_by_user_id === currentUser?.id;
        const isFree = !row.processed_by_user_id;

        return `
            <tr class="border-b border-white/5 bg-slate-900/20">
                <td class="p-4">${row.subject}</td>
                <td class="p-4 text-center text-blue-400 text-xs">${row.processed_by_name || '—'}</td>
                <td class="p-4 flex gap-2 justify-end">
                    <a href="${row.file_url}" target="_blank" class="bg-slate-700 px-3 py-1 rounded text-xs">عرض</a>
                    ${isFree && row.status === 'pending' ? `<button onclick="updateAction(event, ${row.id}, 'claim')" class="bg-amber-600 px-3 py-1 rounded text-xs">حجز</button>` : ''}
                    ${isMe && row.status === 'reviewing' ? `<button onclick="updateAction(event, ${row.id}, 'approve')" class="bg-green-600 px-3 py-1 rounded text-xs">اعتماد ✅</button>` : ''}
                    ${isMe ? `<button onclick="updateAction(event, ${row.id}, 'release')" class="text-xs opacity-50">إلغاء</button>` : ''}
                </td>
            </tr>
        `;
    }).join("");
}

// تفعيل الفلاتر
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        render();
    };
});

// تشغيل عند التحميل
checkUser();
