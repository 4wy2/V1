const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";

const qs = (id) => document.getElementById(id);

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        qs("loginCard").classList.remove("hidden");
        qs("adminPanel").classList.add("hidden");
        qs("logoutBtn").classList.add("hidden");
        return;
    }

    // فحص الصلاحية
    const { data: admin } = await supa.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    
    if (!admin) {
        alert("تنبيه: لا تملك صلاحية الوصول.");
        await supa.auth.signOut();
        return;
    }

    qs("loginCard").classList.add("hidden");
    qs("adminPanel").classList.remove("hidden");
    qs("logoutBtn").classList.remove("hidden");
    qs("whoami").textContent = session.user.email;
    loadAllRows();
}

async function loadAllRows() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (error) return console.error(error);
    allRows = data;
    renderList();
}

function renderList() {
    const listBox = qs("listBox");
    const search = qs("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => {
        const mFilter = currentFilter === "all" || r.status === currentFilter;
        const mSearch = r.subject.toLowerCase().includes(search);
        return mFilter && mSearch;
    });

    // تحديث الإحصائيات
    qs("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    qs("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    if (filtered.length === 0) {
        listBox.innerHTML = "";
        qs("emptyBox").classList.remove("hidden");
        return;
    }
    qs("emptyBox").classList.add("hidden");

    listBox.innerHTML = filtered.map(row => `
        <div class="glass status-card rounded-3xl p-5 border-r-8 ${row.status === 'approved' ? 'border-emerald-500' : 'border-amber-500'}">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex-1 w-full">
                    <input type="text" value="${row.subject}" 
                           onchange="updateRowName(${row.id}, this.value)"
                           class="bg-transparent border-none text-lg font-bold p-0 focus:ring-0 w-full hover:bg-white/5 rounded px-2" 
                           title="اضغط لتعديل الاسم مباشرة">
                    <div class="flex flex-wrap gap-4 mt-2 text-[11px] text-white/40">
                        <span>🕒 ${new Date(row.created_at).toLocaleDateString('ar-EG')}</span>
                        <span>📄 ${row.note || 'لا توجد ملاحظات'}</span>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <a href="${row.file_url}" target="_blank" class="flex-1 text-center btn-ghost px-4 py-2 rounded-xl text-xs font-bold text-blue-300">فتح</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" 
                            class="flex-1 btn-brand px-4 py-2 rounded-xl text-xs font-bold">
                        ${row.status === 'approved' ? 'تعليق ⏸️' : 'اعتماد ✅'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="p-2 btn-ghost rounded-xl text-red-500">🗑️</button>
                </div>
            </div>
        </div>
    `).join("");
}

// الدوال التفاعلية
window.toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    await supa.from("resources").update({ status: newStatus }).eq("id", id);
    loadAllRows();
};

window.updateRowName = async (id, newName) => {
    await supa.from("resources").update({ subject: newName }).eq("id", id);
    // تحديث محلي سريع بدون إعادة تحميل
    allRows = allRows.map(r => r.id === id ? {...r, subject: newName} : r);
};

window.deleteRow = async (id) => {
    if (confirm("هل تريد حذف هذا الملف نهائياً؟")) {
        await supa.from("resources").delete().eq("id", id);
        loadAllRows();
    }
};

// تشغيل الأحداث
document.addEventListener("DOMContentLoaded", () => {
    refreshUI();
    qs("loginForm").onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await supa.auth.signInWithPassword({
            email: qs("email").value,
            password: qs("password").value
        });
        if (error) alert("خطأ في البيانات: " + error.message);
        else refreshUI();
    };
    qs("logoutBtn").onclick = async () => { await supa.auth.signOut(); location.reload(); };
    qs("refreshBtn").onclick = loadAllRows;
    qs("searchBox").oninput = renderList;
    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            renderList();
        };
    });
});
