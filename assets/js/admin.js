// admin.js - النسخة النهائية المضمونة 100% لجميع المتصفحات والأجهزة
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// ضمان ظهور التنبيهات فوق كل شيء
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-indigo-600' };
    toast.className = `${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm mb-2 animate-bounce relative z-[9999]`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// تعريف الدوال في الـ window فوراً لضمان وصول أزرار اللابتوب لها
window.updateRowStatus = async (id, type) => {
    event?.preventDefault(); // منع أي سلوك افتراضي للمتصفح
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };

    try {
        const { error } = await supa.from("resources").update(updates).eq("id", id);
        if (error) throw error;
        showToast("تم تحديث الحالة", "success");
        loadData();
    } catch (err) {
        showToast(err.message, "error");
    }
};

window.deleteResource = async (id, filePath) => {
    event?.preventDefault();
    if (!currentUser.isSuper || !confirm("هل أنت متأكد من الحذف النهائي؟")) return;
    try {
        if (filePath && filePath !== 'null' && filePath !== 'undefined') {
            await supa.storage.from("ee-resources").remove([filePath]);
        }
        const { error } = await supa.from("resources").delete().eq("id", id);
        if (error) throw error;
        showToast("تم الحذف بنجاح", "success");
        loadData();
    } catch (err) { showToast("فشل الحذف", "error"); }
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note }).eq("id", id);
    showToast("تم حفظ الملاحظة", "info");
};

// تسجيل الدخول
const loginForm = document.getElementById("loginForm");
if(loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button");
        const spinner = document.getElementById("loginSpinner");
        try {
            btn.disabled = true;
            spinner.classList.remove("hidden");
            const { error } = await supa.auth.signInWithPassword({
                email: document.getElementById("email").value,
                password: document.getElementById("password").value
            });
            if (error) throw error;
            checkUser();
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            spinner.classList.add("hidden");
        }
    };
}

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    const { data: admin } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    currentUser = { id: session.user.id, name: admin?.full_name || "مشرف", isSuper: !!admin?.is_super };
    
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[10px] font-black uppercase">${currentUser.isSuper ? '👑 رئيس النظام' : '🛡️ مشرف مراجعة'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (!error) { 
        allRows = data; 
        render(); 
    }
}

function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));
    
    const desktopBody = document.getElementById("desktopList");
    const mobileBody = document.getElementById("mobileList");
    document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;

        // مفتاح الحل: إضافة pointer-events-auto و cursor-pointer و z-index عالٍ
        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer hover:bg-blue-600 hover:text-white transition-all pointer-events-auto relative z-30">فتح</a>`;
        
        if (row.status === 'pending') {
            btns += `<button onclick="window.updateRowStatus(${rId}, 'claim')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer hover:bg-amber-500 transition-all pointer-events-auto relative z-30">حجز</button>`;
        } else if (row.status === 'reviewing') {
            if (canManage) {
                btns += `<button onclick="window.updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black cursor-pointer hover:bg-emerald-500 transition-all pointer-events-auto relative z-30">اعتماد ✅</button>`;
                btns += `<button onclick="window.updateRowStatus(${rId}, 'release')" class="bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[10px] cursor-pointer hover:bg-slate-600 transition-all pointer-events-auto relative z-30">إلغاء</button>`;
            } else {
                btns += `<span class="text-[9px] text-slate-500 italic px-2 py-1 bg-white/5 rounded border border-white/5">🔒 لـ ${row.processed_by_name || 'زميل'}</span>`;
            }
        }
        if (currentUser.isSuper) {
            btns += `<button onclick="window.deleteResource(${rId}, '${row.file_path}')" class="text-rose-500 hover:scale-125 transition-all p-2 cursor-pointer pointer-events-auto relative z-30">🗑️</button>`;
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors relative">
                <td class="p-4 text-white font-bold text-sm">${row.subject}</td>
                <td class="p-4"><input type="text" onblur="window.updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/20 border border-slate-700 rounded-lg p-2 text-xs text-slate-400 outline-none focus:border-blue-500 relative z-10"></td>
                <td class="p-4 text-center text-[10px] text-blue-400 font-bold">${row.processed_by_name || "حر"}</td>
                <td class="p-4 text-left"><div class="flex gap-2 justify-end items-center relative z-40 pointer-events-auto">${btns}</div></td>
            </tr>`,
            mobile: `<div class="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 space-y-4 relative">
                <div class="flex justify-between items-center"><h3 class="font-black text-white text-sm">${row.subject}</h3></div>
                <input type="text" onblur="window.updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
                <div class="flex gap-2 items-center flex-wrap relative z-20 pointer-events-auto">${btns}</div>
            </div>`
        };
    });

    if(desktopBody) desktopBody.innerHTML = items.map(h => h.desktop).join("");
    if(mobileBody) mobileBody.innerHTML = items.map(h => h.mobile).join("");
    updateStats();
}

// الفلاتر والبحث
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = (e) => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
        btn.classList.add("bg-blue-600", "text-white");
        render();
    };
});

const searchBox = document.getElementById("searchBox");
if(searchBox) searchBox.oninput = render;

function updateStats() {
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    const div = document.getElementById("productivityStats");
    if (div) div.innerHTML = `
        <div class="text-center"><p class="text-[8px] text-slate-500 font-bold uppercase">منجز</p><p class="text-lg font-black text-emerald-400">${stats.done}</p></div>
        <div class="w-px h-6 bg-slate-700 mx-4"></div>
        <div class="text-center"><p class="text-[8px] text-slate-500 font-bold uppercase">محجوز</p><p class="text-lg font-black text-amber-400">${stats.pending}</p></div>`;
}

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
