const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// --- نظام التنبيهات ---
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-600' };
    toast.className = `${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm animate-fade-in`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- إدارة الدخول ---
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    try {
        btn.disabled = true;
        btn.innerText = "جاري الدخول...";
        const { error } = await supa.auth.signInWithPassword({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        });
        if (error) throw error;
        checkUser();
    } catch (err) {
        showToast(err.message, 'error');
        btn.innerText = "دخول النظام";
        btn.disabled = false;
    }
};

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // جلب بيانات المشرف
    const { data: admin } = await supa.from("admins").select("full_name, is_super").eq("user_id", session.user.id).maybeSingle();
    
    currentUser = {
        id: session.user.id,
        name: admin?.full_name || session.user.email.split("@")[0],
        isSuper: !!admin?.is_super
    };

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    
    document.getElementById("whoami").innerHTML = `
        <span class="text-blue-400 text-[10px] font-black uppercase">المشرف المسؤول</span>
        <span class="text-white font-black text-lg">${currentUser.name} ${currentUser.isSuper ? '👑' : ''}</span>
    `;
    loadData();
}

// --- معالجة البيانات ---
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (!error) {
        allRows = data || [];
        render();
    }
}

function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));

    // تحديث الإحصائيات والإجمالي
    document.getElementById("totalCount").textContent = filtered.length;
    updateStats();

    const desktop = document.getElementById("desktopList");
    const mobile = document.getElementById("mobileList");

    const html = filtered.map(row => {
        const isMe = row.processed_by_user_id === currentUser.id;
        const isFree = !row.processed_by_user_id;
        const canManage = isMe || currentUser.isSuper;

        let actionBtns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;

        if (row.status === "pending" && (isFree || currentUser.isSuper)) {
            actionBtns += `<button onclick="updateRow(${row.id}, 'claim')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز</button>`;
        } else if (canManage && row.status === "reviewing") {
            actionBtns += `<button onclick="updateRow(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">اعتماد ✅</button>`;
            actionBtns += `<button onclick="updateRow(${row.id}, 'release')" class="text-slate-500 text-[10px]">إلغاء</button>`;
        } else if (!isFree && !isMe) {
            actionBtns = `<span class="text-[10px] text-slate-500 italic">🔒 لـ ${row.processed_by_name}</span>`;
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50 hover:bg-white/5 transition-all">
                <td class="p-4 text-white font-bold">${row.subject || "--"}</td>
                <td class="p-4"><textarea onchange="updateNote(${row.id}, this.value)" class="w-full bg-black/20 border border-slate-700 rounded-lg p-2 text-xs text-slate-300">${row.admin_note || ""}</textarea></td>
                <td class="p-4 text-center text-[10px] text-blue-400">${row.processed_by_name || "--"}</td>
                <td class="p-4 flex gap-2 justify-end">${actionBtns}</td>
            </tr>`,
            mobile: `<div class="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 space-y-3">
                <h3 class="font-black text-white">${row.subject}</h3>
                <textarea onchange="updateNote(${row.id}, this.value)" class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs" placeholder="ملاحظة...">${row.admin_note || ""}</textarea>
                <div class="flex gap-2">${actionBtns}</div>
            </div>`
        };
    });

    desktop.innerHTML = html.map(h => h.desktop).join("");
    mobile.innerHTML = html.map(h => h.mobile).join("");
}

// --- الأكشنات (تم تنظيفها) ---
window.updateRow = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else updates = { status: type, updated_at: new Date().toISOString() };

    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) { showToast("تم التحديث بنجاح", "success"); loadData(); }
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note }).eq("id", id);
    showToast("تم حفظ الملاحظة", "info");
};

function updateStats() {
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    document.getElementById("productivityStats").innerHTML = `
        <div class="text-center"><p class="text-[8px] text-slate-500 uppercase">منجز</p><p class="text-lg font-black text-emerald-400">${stats.done}</p></div>
        <div class="w-px h-6 bg-slate-700"></div>
        <div class="text-center"><p class="text-[8px] text-slate-500 uppercase">قيد المراجعة</p><p class="text-lg font-black text-amber-400">${stats.pending}</p></div>
    `;
}

// الفلاتر والبحث
document.getElementById("searchBox").oninput = render;
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
        btn.classList.add("bg-blue-600", "text-white");
        render();
    };
});

checkUser();
