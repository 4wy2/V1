// admin.js - النسخة المصلحة بالكامل
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// --- دالة تسجيل الدخول الجديدة ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        
        if (error) {
            notify("بيانات الدخول خاطئة: " + error.message, "error");
        } else {
            notify("تم تسجيل الدخول بنجاح", "success");
            checkUser(); 
        }
    };
}

const notify = (msg, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const themes = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-indigo-600' };
    toast.className = `${themes[type]} text-white px-6 py-4 rounded-2xl shadow-xl font-bold text-sm mb-2 animate-bounce transition-all`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
};

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
        <p class="text-blue-400 text-[10px] font-black uppercase">${currentUser.isSuper ? '👑 رئيس النظام' : '🛡️ مشرف مراجعة'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

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
    } catch (err) { notify(err.message, "error"); }
};

async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (error) return notify("خطأ في الاتصال بالداتا", "error");
    allRows = data || [];
    render();
}

function render() {
    const searchInput = document.getElementById("searchBox");
    const search = (searchInput ? searchInput.value : "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));

    document.getElementById("totalCount").textContent = filtered.length;
    
    const html = filtered.map(row => {
        const isOwner = row.processed_by_user_id === currentUser.id;
        const canManage = isOwner || currentUser.isSuper;
        const rId = `'${row.id}'`;

        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;
        
        if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز</button>`;
        } else if (row.status === 'reviewing') {
            if (canManage) {
                btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black">اعتماد ✅</button>`;
                btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-xl text-[10px]">إلغاء</button>`;
            } else {
                btns += `<span class="text-[10px] text-slate-500 font-bold px-3 py-2 bg-white/5 rounded-lg border border-white/5">🔒 لـ ${row.processed_by_name || 'زميل'}</span>`;
            }
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td class="p-4 text-white font-bold text-sm">${row.subject}</td>
                <td class="p-4"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/40 border border-slate-800 rounded-xl p-2 text-xs text-slate-400"></td>
                <td class="p-4 text-center text-[11px] font-black ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-4 flex gap-2 justify-end items-center">${btns}</td>
            </tr>`,
            mobile: `<div class="bg-slate-900/60 p-5 rounded-[2rem] border border-white/5 space-y-4 shadow-xl">
                <h3 class="font-black text-white text-base">${row.subject}</h3>
                <div class="flex gap-2 items-center flex-wrap">${btns}</div>
            </div>`
        };
    });

    document.getElementById("desktopList").innerHTML = html.map(h => h.desktop).join("");
    document.getElementById("mobileList").innerHTML = html.map(h => h.mobile).join("");
    updateStats();
}

function updateStats() {
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    
    const div = document.getElementById("productivityStats");
    if (div) div.innerHTML = `
        <div class="text-center group"><p class="text-[8px] text-slate-500 font-black uppercase">إنجازك</p><p class="text-xl font-black text-emerald-400">${stats.done}</p></div>
        <div class="w-px h-8 bg-slate-800 mx-4"></div>
        <div class="text-center group"><p class="text-[8px] text-slate-500 font-black uppercase">حجوزاتك</p><p class="text-xl font-black text-amber-400">${stats.pending}</p></div>`;
    
    renderTeamLeaderboard(); // تم الإصلاح: الاستدعاء الآن خارج الـ Object
}

function renderTeamLeaderboard() {
    if (!currentUser.isSuper) return;
    const leaderboardSection = document.getElementById("leaderboardSection");
    if (!leaderboardSection) return;

    const statsMap = {};
    allRows.forEach(row => {
        if (row.status === 'approved' && row.processed_by_name) {
            statsMap[row.processed_by_name] = (statsMap[row.processed_by_name] || 0) + 1;
        }
    });

    const sortedStats = Object.entries(statsMap).sort((a, b) => b[1] - a[1]);
    const html = sortedStats.map(([name, count], index) => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
            <div class="flex items-center gap-3">
                <span class="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-black">${index + 1}</span>
                <p class="text-xs text-slate-200 font-bold">${name}</p>
            </div>
            <p class="text-sm font-black text-emerald-400">${count}</p>
        </div>
    `).join("");

    leaderboardSection.innerHTML = `
        <div class="mt-8 mb-6"><h2 class="text-white font-black text-sm mb-4 border-r-4 border-blue-600 pr-3">🏆 إنجازات الفريق</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${html || '<p class="text-slate-600 text-xs">لا يوجد بيانات</p>'}</div></div>`;
}

// الفلاتر والبحث
const searchBox = document.getElementById("searchBox");
if(searchBox) searchBox.addEventListener('input', render);

document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.className = "filterBtn flex-1 py-3 px-4 text-xs font-black rounded-xl text-slate-400");
        btn.className = "filterBtn flex-1 py-3 px-4 text-xs font-black rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-900/20";
        render();
    };
});

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note }).eq("id", id);
};

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
