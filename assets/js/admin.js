// admin.js - نسخة "الرئيس" (صلاحيات كاملة)
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// 1. نظام التنبيهات (Toast)
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-600' };
    toast.className = `${colors[type] || colors.info} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm mb-2 transition-all duration-300`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// 2. إدارة الدخول
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    try {
        btn.disabled = true;
        const { error } = await supa.auth.signInWithPassword({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        });
        if (error) throw error;
        checkUser();
    } catch (err) {
        showToast("خطأ: " + err.message, 'error');
        btn.disabled = false;
    }
};

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // جلب بياناتك من جدول المشرفين
    const { data: admin } = await supa.from("admins").select("full_name, is_super").eq("user_id", session.user.id).maybeSingle();
    
    currentUser = {
        id: session.user.id,
        name: admin?.full_name || "مشرف",
        isSuper: !!admin?.is_super // هنا تتفعل صلاحيتك كرئيس
    };

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[10px] font-black uppercase">${currentUser.isSuper ? 'رئيس اللجنة العلمية 👑' : 'مشرف مراجعة 🛡️'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

// 3. جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (!error) {
        allRows = data || [];
        render();
    }
}

// 4. دالة الحذف (للرئيس فقط)
window.deleteResource = async (id, filePath) => {
    if (!currentUser.isSuper) return;
    if (!confirm("⚠️ تنبيه للرئيس: هل تريد حذف هذا الملف نهائياً من السيرفر؟ (هذا سيوفر مساحة الـ 1GB)")) return;

    try {
        if (filePath) await supa.storage.from("ee-resources").remove([filePath]);
        const { error } = await supa.from("resources").delete().eq("id", id);
        if (error) throw error;
        showToast("تم الحذف وتوفير المساحة", "success");
        loadData();
    } catch (err) {
        showToast("فشل الحذف: " + err.message, "error");
    }
};

// 5. الأكشنات (الحجز، الاعتماد، فك الحجز)
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') {
        updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    } else if (type === 'release') {
        updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    } else if (type === 'approved') {
        updates = { status: 'approved', updated_at: new Date().toISOString() };
    }

    try {
        const { error } = await supa.from("resources").update(updates).eq("id", id);
        if (error) throw error;
        showToast("تم التحديث بنجاح", "success");
        loadData();
    } catch (err) {
        showToast("خطأ: " + err.message, "error");
    }
};

// 6. العرض (الـ Render)
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));

    document.getElementById("totalCount").textContent = filtered.length;
    updateStats();

    const html = filtered.map(row => {
        const isMe = row.processed_by_user_id === currentUser.id;
        const isFree = !row.processed_by_user_id;
        // صلاحيتك المطلقة: إذا كنت الرئيس، تقدر تتحكم بأي ملف حتى لو محجوز
        const canManage = isMe || currentUser.isSuper;

        let actionBtns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;

        if (row.status === "pending") {
            actionBtns += `<button onclick="updateRowStatus(${row.id}, 'claim')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز</button>`;
        } else if (row.status === "reviewing") {
            if (canManage) {
                actionBtns += `<button onclick="updateRowStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">اعتماد ✅</button>`;
                actionBtns += `<button onclick="updateRowStatus(${row.id}, 'release')" class="bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[10px]">فك الحجز</button>`;
            } else {
                actionBtns += `<span class="text-[10px] text-slate-500 italic px-2">🔒 محجوز لـ ${row.processed_by_name}</span>`;
            }
        }

        // زر الحذف للرئيس فقط
        if (currentUser.isSuper) {
            actionBtns += `<button onclick="deleteResource(${row.id}, '${row.file_path}')" class="bg-red-600/10 text-red-500 p-2 rounded-xl hover:bg-red-600 hover:text-white transition-all">🗑️</button>`;
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50 hover:bg-white/5 transition-all">
                <td class="p-4 text-white font-bold text-sm">${row.subject || "--"}</td>
                <td class="p-4"><input type="text" onblur="updateNote(${row.id}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/20 border border-slate-700 rounded-lg p-2 text-xs text-slate-300" placeholder="أضف ملاحظة..."></td>
                <td class="p-4 text-center text-[10px] text-blue-400 font-bold">${row.processed_by_name || "حر"}</td>
                <td class="p-4 flex gap-2 justify-end items-center">${actionBtns}</td>
            </tr>`,
            mobile: `<div class="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-black text-white text-sm">${row.subject}</h3><span class="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg">${row.status}</span></div>
                <div class="flex gap-2 flex-wrap">${actionBtns}</div>
            </div>`
        };
    });

    document.getElementById("desktopList").innerHTML = html.map(h => h.desktop).join("");
    document.getElementById("mobileList").innerHTML = html.map(h => h.mobile).join("");
}

// بقية الدوال (UpdateNote, Stats, Logout)
window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note }).eq("id", id);
    showToast("تم حفظ الملاحظة", "info");
};

function updateStats() {
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    const statsDiv = document.getElementById("productivityStats");
    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="text-center"><p class="text-[8px] text-slate-500 font-bold uppercase">منجزاتك</p><p class="text-lg font-black text-emerald-400">${stats.done}</p></div>
            <div class="w-px h-6 bg-slate-700 mx-4"></div>
            <div class="text-center"><p class="text-[8px] text-slate-500 font-bold uppercase">قيد العمل</p><p class="text-lg font-black text-amber-400">${stats.pending}</p></div>
        `;
    }
}

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
