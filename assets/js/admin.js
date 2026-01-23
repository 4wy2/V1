const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";

const qs = (id) => document.getElementById(id);

// 1. التحقق من الدخول والصلاحية
async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        qs("loginCard").classList.remove("hidden");
        qs("adminPanel").classList.add("hidden");
        qs("logoutBtn").classList.add("hidden");
        return;
    }

    const { data: admin } = await supa.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    
    if (!admin) {
        alert("عذراً، لا تملك صلاحية أدمن.");
        await supa.auth.signOut();
        location.reload();
        return;
    }

    qs("loginCard").classList.add("hidden");
    qs("adminPanel").classList.remove("hidden");
    qs("logoutBtn").classList.remove("hidden");
    qs("whoami").textContent = `مرحباً: ${session.user.email}`;
    loadAllRows();
}

// 2. جلب البيانات من السيرفر
async function loadAllRows() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (error) return console.error(error);
    allRows = data || [];
    renderList();
}

// 3. عرض البيانات في الصفحة (الرسم البصري)
function renderList() {
    const listBox = qs("listBox");
    const search = qs("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => {
        const matchesFilter = currentFilter === "all" || r.status === currentFilter;
        const matchesSearch = (r.subject || "").toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
    });

    // تحديث الإحصائيات في الأعلى
    qs("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    qs("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    if (filtered.length === 0) {
        listBox.innerHTML = "";
        qs("emptyBox").classList.remove("hidden");
        return;
    }
    qs("emptyBox").classList.add("hidden");

    listBox.innerHTML = filtered.map(row => `
        <div class="glass status-card rounded-3xl p-5 border-r-8 ${row.status === 'approved' ? 'border-emerald-500' : 'border-amber-500'} mb-4">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex-1 w-full">
                    <input type="text" value="${row.subject}" 
                           onchange="updateSubjectName(${row.id}, this.value)"
                           class="bg-transparent border-none text-lg font-black p-0 focus:ring-0 w-full hover:bg-white/5 rounded px-2">
                    <div class="flex gap-4 mt-1 text-[10px] text-white/40 font-bold uppercase">
                        <span>📅 ${new Date(row.created_at).toLocaleDateString('ar-EG')}</span>
                        <span class="${row.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}">الحالة: ${row.status}</span>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <a href="${row.file_url}" target="_blank" class="flex-1 text-center bg-white/5 hover:bg-white/10 p-2 rounded-xl text-xs font-bold">فتح</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" 
                            class="flex-1 btn-brand px-6 py-2 rounded-xl text-xs font-bold text-white">
                        ${row.status === 'approved' ? 'تعليق ⏸️' : 'اعتماد ✅'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="p-2 text-red-500 hover:bg-red-500/10 rounded-xl">🗑️</button>
                </div>
            </div>
        </div>
    `).join("");
}

// 4. الدوال التفاعلية (أكشن)
window.toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    
    // تحديث محلي فوري للسرعة
    allRows = allRows.map(r => r.id === id ? {...r, status: newStatus} : r);
    renderList();

    // إرسال للسيرفر
    const { error } = await supa.from("resources").update({ status: newStatus }).eq("id", id);
    if (error) alert("خطأ في المزامنة: " + error.message);
};

window.updateSubjectName = async (id, newName) => {
    const { error } = await supa.from("resources").update({ subject: newName }).eq("id", id);
    if (error) alert("فشل التعديل");
    else {
        allRows = allRows.map(r => r.id === id ? {...r, subject: newName} : r);
        renderList();
    }
};

window.deleteRow = async (id) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (error) alert(error.message);
    else {
        allRows = allRows.filter(r => r.id !== id);
        renderList();
    }
};

// 5. تهيئة الأحداث
document.addEventListener("DOMContentLoaded", () => {
    refreshUI();

    qs("loginForm").onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await supa.auth.signInWithPassword({
            email: qs("email").value,
            password: qs("password").value
        });
        if (error) alert("فشل الدخول: " + error.message);
        else refreshUI();
    };

    qs("logoutBtn").onclick = async () => { await supa.auth.signOut(); location.reload(); };
    qs("refreshBtn").onclick = loadAllRows;
    qs("searchBox").oninput = renderList;
    
    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-white/20"));
            btn.classList.add("bg-white/20");
            renderList();
        };
    });
});
