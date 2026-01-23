const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";

const qs = (id) => document.getElementById(id);

// التحقق من الجلسة والصلاحيات
async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        qs("loginCard").classList.remove("hidden");
        qs("adminPanel").classList.add("hidden");
        return;
    }
    // التأكد أن المستخدم أدمن
    const { data: admin } = await supa.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (!admin) {
        alert("لا تملك صلاحيات الوصول");
        await supa.auth.signOut();
        return;
    }

    qs("loginCard").classList.add("hidden");
    qs("adminPanel").classList.remove("hidden");
    qs("whoami").textContent = `المشرف: ${session.user.email}`;
    loadAllRows();
}

// جلب البيانات
async function loadAllRows() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (error) return console.error(error);
    allRows = data || [];
    renderList();
}

// رسم القائمة بتنسيق اللجنة العلمية
function renderList() {
    const listBox = qs("listBox");
    const search = qs("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => {
        const mFilter = currentFilter === "all" || r.status === currentFilter;
        const mSearch = (r.subject || "").toLowerCase().includes(search);
        return mFilter && mSearch;
    });

    qs("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    qs("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    if (filtered.length === 0) {
        listBox.innerHTML = '<div class="text-center py-20 opacity-30">لا توجد ملفات</div>';
        return;
    }

    listBox.innerHTML = filtered.map(row => `
        <div class="glass rounded-3xl p-6 border-r-8 ${row.status === 'approved' ? 'border-emerald-500' : 'border-amber-500'} mb-6 shadow-xl transition-all">
            <div class="flex flex-col md:flex-row justify-between items-start gap-4">
                <div class="flex-1 w-full">
                    <input type="text" value="${row.subject || ''}" 
                           onchange="updateSubjectName(${row.id}, this.value)"
                           class="bg-transparent border-none text-xl font-black p-0 focus:ring-0 w-full hover:bg-white/5 rounded px-2">
                    <div class="flex gap-4 mt-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                        <span>📅 ${new Date(row.created_at).toLocaleDateString('ar-EG')}</span>
                        <span class="${row.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}">الحالة: ${row.status}</span>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <a href="${row.file_url}" target="_blank" class="flex-1 text-center bg-white/5 hover:bg-white/10 p-3 rounded-2xl text-xs font-bold">معاينة</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" 
                            class="flex-[2] btn-brand px-6 py-3 rounded-2xl text-xs font-black text-white">
                        ${row.status === 'approved' ? 'تعليق النشر' : 'اعتماد ونشر ✅'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="p-3 text-red-500 hover:bg-red-500/10 rounded-2xl">🗑️</button>
                </div>
            </div>

            <div class="mt-6 pt-5 border-t border-white/10">
                <div class="flex items-center justify-between mb-3">
                    <label class="text-[11px] font-black text-white/40 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        ملاحظات الفرز العلمي
                    </label>
                    <span class="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                        بواسطة: ${row.processed_by || 'لم يحدد بعد'}
                    </span>
                </div>
                <textarea 
                    onchange="saveAdminNote(${row.id}, this.value)"
                    placeholder="اكتب تقرير اللجنة هنا (مثال: المحتوى دقيق، جودة الـ PDF ضعيفة...)"
                    class="w-full bg-black/30 border border-white/5 rounded-2xl p-4 text-sm text-white/70 focus:border-blue-500/50 outline-none transition-all resize-none h-24 shadow-inner"
                >${row.admin_note || ''}</textarea>
            </div>
        </div>
    `).join("");
}

// التفاعل مع السيرفر
window.toggleStatus = async (id, currentStatus) => {
    const { data: { session } } = await supa.auth.getSession();
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    
    // تحديث محلي فوري
    allRows = allRows.map(r => r.id === id ? {...r, status: newStatus, processed_by: session.user.email} : r);
    renderList();

    await supa.from("resources").update({ 
        status: newStatus, 
        processed_by: session.user.email 
    }).eq("id", id);
};

window.saveAdminNote = async (id, note) => {
    const { data: { session } } = await supa.auth.getSession();
    
    // تحديث محلي
    allRows = allRows.map(r => r.id === id ? {...r, admin_note: note, processed_by: session.user.email} : r);
    renderList();

    const { error } = await supa.from("resources").update({ 
        admin_note: note,
        processed_by: session.user.email 
    }).eq("id", id);

    if (error) alert("فشل حفظ الملاحظة");
};

window.updateSubjectName = async (id, newName) => {
    await supa.from("resources").update({ subject: newName }).eq("id", id);
};

window.deleteRow = async (id) => {
    if (!confirm("حذف نهائي؟")) return;
    await supa.from("resources").delete().eq("id", id);
    allRows = allRows.filter(r => r.id !== id);
    renderList();
};

// تشغيل الأحداث
document.addEventListener("DOMContentLoaded", () => {
    refreshUI();
    qs("loginForm").onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await supa.auth.signInWithPassword({ email: qs("email").value, password: qs("password").value });
        if (error) alert(error.message); else refreshUI();
    };
    qs("refreshBtn").onclick = loadAllRows;
    qs("searchBox").oninput = renderList;
    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-white/10", "border-blue-500/50"));
            btn.classList.add("bg-white/10", "border-blue-500/50");
            renderList();
        };
    });
});
