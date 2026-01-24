// admin.js - النسخة الاحترافية المتكاملة
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// 1. نظام التنبيهات الذكي
const notify = (msg, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const themes = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-indigo-600' };
    toast.className = `${themes[type]} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm mb-2 animate-bounce transition-all relative z-[9999]`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
};

// 2. معالجة تسجيل الدخول
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const btn = e.submitter;
        
        btn.disabled = true;
        btn.innerText = "جاري الدخول...";

        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        
        if (error) {
            notify("بيانات الدخول غير صحيحة", "error");
            btn.disabled = false;
            btn.innerText = "دخول";
        } else {
            checkUser();
        }
    };
}

// 3. التحقق من رتبة المستخدم
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    const { data: admin } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    
    currentUser = {
        id: session.user.id,
        name: admin?.full_name || "مشرف مجهول",
        isSuper: !!admin?.is_super
    };

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[10px] font-black uppercase tracking-widest">${currentUser.isSuper ? '👑 رئيس اللجنة' : '🛡️ مشرف مراجعة'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

// 4. جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (error) return notify("فشل الاتصال بقاعدة البيانات", "error");
    allRows = data || [];
    render();
}

// 5. تحديث الحالة (مع مراعاة اللابتوب)
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };

    try {
        const { error } = await supa.from("resources").update(updates).eq("id", id);
        if (error) throw error;
        notify("تم التحديث بنجاح", "success");
        loadData();
    } catch (err) { notify("خطأ: " + err.message, "error"); }
};

// 6. عرض لوحة الإنجازات (للرئيس فقط)
function renderTeamLeaderboard() {
    if (!currentUser.isSuper) return;
    const container = document.getElementById("leaderboardSection");
    if (!container) return;

    const statsMap = {};
    allRows.forEach(row => {
        if (row.processed_by_name) {
            const name = row.processed_by_name;
            if (!statsMap[name]) statsMap[name] = { approved: 0, reviewing: 0 };
            if (row.status === 'approved') statsMap[name].approved++;
            else if (row.status === 'reviewing') statsMap[name].reviewing++;
        }
    });

    const sorted = Object.entries(statsMap).sort((a, b) => b[1].approved - a[1].approved);
    
    const cards = sorted.map(([name, stat], i) => `
        <div class="bg-slate-900/50 border border-white/5 p-4 rounded-[2rem] shadow-xl hover:border-blue-500/30 transition-all group">
            <div class="flex items-center gap-3 mb-3">
                <span class="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black">${i+1}</span>
                <p class="text-xs text-slate-200 font-bold group-hover:text-blue-400 transition-colors">${name}</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div class="bg-black/40 p-2.5 rounded-2xl text-center">
                    <p class="text-[7px] text-slate-500 font-black uppercase">تم الاعتماد</p>
                    <p class="text-sm font-black text-emerald-400">${stat.approved}</p>
                </div>
                <div class="bg-black/40 p-2.5 rounded-2xl text-center">
                    <p class="text-[7px] text-slate-500 font-black uppercase">قيد العمل</p>
                    <p class="text-sm font-black text-amber-400">${stat.reviewing}</p>
                </div>
            </div>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="mt-8 mb-8 animate-fade-in">
            <div class="flex items-center gap-2 mb-5 border-r-4 border-blue-600 pr-3">
                <h2 class="text-white font-black text-xs uppercase tracking-widest">🏆 مراقبة أداء الفريق</h2>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${cards || '<p class="text-slate-600 text-[10px] italic">لا يوجد نشاط مسجل...</p>'}</div>
        </div>
    `;
}

// 7. عرض الجدول والقوائم
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));
    
    document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        
        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all relative z-50">فتح</a>`;
        
        if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black relative z-50">حجز</button>`;
        } else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black relative z-50">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-xl text-[10px] relative z-50">إلغاء</button>`;
        } else if (row.status === 'reviewing') {
            btns += `<span class="text-[9px] text-slate-500 font-bold px-2 py-1 bg-white/5 rounded-lg border border-white/5">🔒 لـ ${row.processed_by_name}</span>`;
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50 hover:bg-white/[0.01] transition-all">
                <td class="p-4 text-white font-bold text-sm">${row.subject}</td>
                <td class="p-4"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/40 border border-slate-800 rounded-xl p-2 text-xs text-slate-400 outline-none focus:border-blue-500/50"></td>
                <td class="p-4 text-center text-[10px] font-black ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-4 flex gap-2 justify-end pointer-events-auto">${btns}</td>
            </tr>`,
            mobile: `<div class="bg-slate-900/40 p-5 rounded-[2.5rem] border border-white/5 space-y-4">
                <h3 class="font-black text-white text-sm">${row.subject}</h3>
                <div class="flex gap-2 items-center flex-wrap pointer-events-auto">${btns}</div>
            </div>`
        };
    });

    document.getElementById("desktopList").innerHTML = items.map(h => h.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(h => h.mobile).join("");
    updateStats();
}

// 8. تحديث الإحصائيات الشخصية
function updateStats() {
    const mine = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    const div = document.getElementById("productivityStats");
    if (div) div.innerHTML = `
        <div class="text-center"><p class="text-[8px] text-slate-500 font-black uppercase">إنجازك</p><p class="text-xl font-black text-emerald-400">${mine.done}</p></div>
        <div class="w-px h-8 bg-slate-800 mx-4"></div>
        <div class="text-center"><p class="text-[8px] text-slate-500 font-black uppercase">حجوزاتك</p><p class="text-xl font-black text-amber-400">${mine.pending}</p></div>`;
    
    renderTeamLeaderboard();
}

// 9. تفاعلات الصفحة
document.getElementById("searchBox")?.addEventListener('input', render);

document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.className = "filterBtn flex-1 py-3 px-4 text-xs font-black rounded-xl text-slate-400");
        btn.className = "filterBtn flex-1 py-3 px-4 text-xs font-black rounded-xl bg-blue-600 text-white shadow-lg";
        render();
    };
});

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note }).eq("id", id);
};

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };

checkUser();
