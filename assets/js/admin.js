const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// --- 1. التنبيهات الذكية ---
const notify = (msg, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return alert(msg);
    const themes = { success: 'bg-emerald-500', error: 'bg-rose-500', info: 'bg-blue-500' };
    const toast = document.createElement('div');
    toast.className = `${themes[type]} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs mb-3 transition-all duration-500 transform translate-y-0`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); setTimeout(() => toast.remove(), 500); }, 3000);
};

// --- 2. إدارة الدخول وصلاحيات "الرئيس" ---
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    const { data: admin } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    currentUser = { 
        id: session.user.id, 
        name: admin?.full_name || "Reviewer", 
        isSuper: !!admin?.is_super 
    };

    // إظهار زر "شغل الشباب" للرئيس فقط
    const teamBtn = document.getElementById("teamWorkBtn");
    if (teamBtn) currentUser.isSuper ? teamBtn.classList.remove("hidden") : teamBtn.classList.add("hidden");

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[8px] font-black uppercase tracking-[0.2em] mb-1">${currentUser.isSuper ? '👑 Head Admin' : '🛡️ Reviewer'}</p>
        <p class="text-white font-black text-lg md:text-xl leading-none">${currentUser.name}</p>`;
    
    loadData();
}

// --- 3. جلب وعرض البيانات ---
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (!error) { allRows = data || []; render(); }
}

function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => 
        (currentFilter === "all" || r.status === currentFilter) && 
        ((r.subject || "").toLowerCase().includes(search) || (r.uploader_name || "").toLowerCase().includes(search))
    );
    
    if (document.getElementById("totalCount")) document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        const typeStyle = { 
            pdf: 'bg-rose-500/10 text-rose-500 border-rose-500/20', 
            png: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
        }[row.file_type?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

        let btns = `<a href="${row.file_url}" target="_blank" class="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-[10px] font-black shadow-lg transition-all">فتح الملف</a>`;
        
        if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-3 rounded-xl text-[10px] font-black transition-all">حجز المهمة</button>`;
        } else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl text-[10px] font-black transition-all">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="px-3 text-slate-500 hover:text-rose-400 transition-all text-xs">✕</button>`;
        } else if (row.status === 'reviewing') {
            btns += `<div class="flex-1 text-center py-3 bg-white/5 rounded-xl border border-white/5 text-[9px] text-slate-500 italic font-bold">🔒 قيد المراجعة: ${row.processed_by_name}</div>`;
        }

        const noteBox = row.note ? `
            <div class="mt-3 p-3 bg-amber-400/5 border border-amber-400/10 rounded-2xl flex gap-3 items-start group">
                <span class="text-base group-hover:rotate-12 transition-transform">💬</span>
                <div class="text-[11px] leading-relaxed">
                    <span class="block text-[8px] font-black uppercase text-amber-500/60 mb-1 italic">ملاحظة الطالب:</span>
                    <span class="text-slate-200">${row.note}</span>
                </div>
            </div>` : '';

        return {
            desktop: `<tr class="group border-b border-slate-800/20 hover:bg-blue-600/[0.02] transition-all">
                <td class="p-6">
                    <div class="font-black text-white text-base mb-1">${row.subject}</div>
                    ${noteBox}
                    <div class="text-[9px] text-slate-500 font-bold mt-2 uppercase">👤 الرافع: ${row.uploader_name || 'Anonymous'}</div>
                </td>
                <td class="p-6"><span class="px-3 py-1 rounded-full text-[9px] font-black border uppercase ${typeStyle}">${row.file_type || 'OTH'}</span></td>
                <td class="p-6"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" placeholder="أضف ملاحظة إدارية..." class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:border-blue-500 outline-none transition-all"></td>
                <td class="p-6 text-center text-[10px] font-black uppercase ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-6"><div class="flex gap-2 justify-end">${btns}</div></td>
            </tr>`,
            mobile: `<div class="bg-slate-900/40 p-5 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
                <div class="flex justify-between items-start">
                    <div class="max-w-[70%]"><h3 class="font-black text-white text-base leading-tight">${row.subject}</h3><p class="text-[9px] text-slate-500 font-bold mt-1 uppercase">👤 ${row.uploader_name || 'Anonymous'}</p></div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black border uppercase ${typeStyle}">${row.file_type || 'FT'}</span>
                </div>
                ${noteBox}
                <div class="space-y-1">
                    <p class="text-[8px] text-slate-500 font-black uppercase px-1 italic">Internal Admin Note:</p>
                    <input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 outline-none" placeholder="...">
                </div>
                <div class="flex gap-2 pt-2">${btns}</div>
            </div>`
        };
    });

    document.getElementById("desktopList").innerHTML = items.map(i => i.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(i => i.mobile).join("");
    updateStats();
}

// --- 4. ميزة "شغل الشباب" (خاصة للرئيس) ---
window.showTeamWork = () => {
    const summary = allRows.reduce((acc, row) => {
        if (row.processed_by_name) {
            if (!acc[row.processed_by_name]) acc[row.processed_by_name] = { done: 0, working: [], count: 0 };
            row.status === 'approved' ? acc[row.processed_by_name].done++ : (acc[row.processed_by_name].count++, acc[row.processed_by_name].working.push(row.subject));
        }
        return acc;
    }, {});

    let html = `
        <div class="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] p-4 flex items-center justify-center animate-in fade-in duration-300">
            <div class="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[3rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl relative">
                <button onclick="this.parentElement.parentElement.remove()" class="absolute top-6 left-6 text-slate-500 hover:text-white text-xl">✕</button>
                <h2 class="text-2xl font-black mb-8 text-white flex items-center gap-3 italic">📊 مراقبة الإنجاز</h2>
                <div class="space-y-6">`;

    for (const name in summary) {
        html += `
            <div class="bg-white/[0.03] p-6 rounded-[2rem] border border-white/5">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-black text-white text-sm">👤 ${name}</div>
                    <div class="flex gap-4 text-center">
                        <div><p class="text-[8px] text-emerald-400 font-black uppercase">تم</p><p class="text-lg font-black">${summary[name].done}</p></div>
                        <div><p class="text-[8px] text-amber-400 font-black uppercase">حجز</p><p class="text-lg font-black">${summary[name].count}</p></div>
                    </div>
                </div>
                ${summary[name].working.length > 0 ? `<div class="flex flex-wrap gap-1 mt-2">${summary[name].working.map(s => `<span class="text-[9px] bg-black/40 text-slate-400 px-2 py-1 rounded-lg border border-white/5 truncate max-w-[120px]">${s}</span>`).join('')}</div>` : ''}
            </div>`;
    }
    html += `</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

// --- 5. تحديث الحالات والإحصائيات ---
window.updateRowStatus = async (id, type) => {
    let updates = type === 'claim' ? { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name } :
                  type === 'release' ? { status: 'pending', processed_by_user_id: null, processed_by_name: null } : { status: 'approved' };
    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) { notify("تم التحديث بنجاح", "success"); loadData(); }
};

window.updateNote = async (id, note) => { await supa.from("resources").update({ admin_note: note }).eq("id", id); };

function updateStats() {
    const total = allRows.length, approved = allRows.filter(r => r.status === "approved").length;
    const mine = { done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
                   pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length };
    
    if (document.getElementById("productivityStats")) {
        document.getElementById("productivityStats").innerHTML = `
            <div class="text-center"><p class="text-[8px] text-emerald-400 font-black mb-1 uppercase">إنجازك</p><p class="text-xl font-black text-white">${mine.done}</p></div>
            <div class="w-px h-8 bg-white/10 mx-4"></div>
            <div class="text-center"><p class="text-[8px] text-amber-400 font-black mb-1 uppercase">حجوزاتك</p><p class="text-xl font-black text-white">${mine.pending}</p></div>`;
    }
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    if (document.getElementById("progressBar")) document.getElementById("progressBar").style.width = `${pct}%`;
    if (document.getElementById("progressText")) document.getElementById("progressText").textContent = `${pct}%`;
}

// --- المستمعات ---
document.getElementById("searchBox")?.addEventListener('input', render);
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.className = "filterBtn flex-1 py-3 text-[10px] font-black rounded-xl text-slate-500");
        btn.className = "filterBtn flex-1 py-3 text-[10px] font-black rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20";
        render();
    };
});
window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
