// admin.js - النسخة النهائية المعتمدة
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// دالة التنبيهات
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-600' };
    toast.className = `${colors[type] || colors.info} text-white px-6 py-4 rounded-2xl shadow-xl font-bold text-sm mb-2 transition-all`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// نظام تسجيل الدخول المحسن
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        btn.disabled = true;
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        showToast("جاري التحقق من الصلاحيات...", "info");
        await checkUser();
    } catch (err) {
        alert("فشل الدخول: " + err.message);
        btn.disabled = false;
    }
};

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // جلب بياناتك من الجدول الظاهر في الصورة
    const { data: admin, error } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    
    if (error || !admin) {
        showToast("حسابك غير مسجل في جدول المشرفين", "error");
        await supa.auth.signOut();
        return;
    }

    currentUser = {
        id: session.user.id,
        name: admin.full_name,
        isSuper: admin.is_super // ستكون TRUE بعد تعديلك للجدول
    };

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[10px] font-black uppercase">${currentUser.isSuper ? '👑 رئيس اللجنة' : '🛡️ مشرف'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

// جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (!error) {
        allRows = data || [];
        render();
    }
}

// دالة الحذف (للرئيس فقط)
window.deleteResource = async (id, filePath) => {
    if (!currentUser.isSuper) return;
    if (!confirm("⚠️ هل أنت متأكد من حذف الملف نهائياً؟")) return;

    try {
        if (filePath) await supa.storage.from("ee-resources").remove([filePath]);
        await supa.from("resources").delete().eq("id", id);
        showToast("تم الحذف بنجاح", "success");
        loadData();
    } catch (err) {
        showToast("خطأ في الحذف", "error");
    }
};

// الأكشنات وكسر الحجز
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') {
        updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    } else if (type === 'release') {
        updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    } else if (type === 'approved') {
        updates = { status: 'approved', updated_at: new Date().toISOString() };
    }

    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) {
        showToast("تم التحديث", "success");
        loadData();
    }
};

function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));

    document.getElementById("totalCount").textContent = filtered.length;
    
    const html = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        let actionBtns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black">فتح</a>`;

        if (row.status === "pending") {
            actionBtns += `<button onclick="updateRowStatus(${row.id}, 'claim')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز</button>`;
        } else if (row.status === "reviewing") {
            if (canManage) {
                actionBtns += `<button onclick="updateRowStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">اعتماد ✅</button>`;
                actionBtns += `<button onclick="updateRowStatus(${row.id}, 'release')" class="bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[10px]">إلغاء الحجز</button>`;
            } else {
                actionBtns += `<span class="text-[10px] text-slate-500 italic px-2">🔒 لـ ${row.processed_by_name}</span>`;
            }
        }

        if (currentUser.isSuper) {
            actionBtns += `<button onclick="deleteResource(${row.id}, '${row.file_path}')" class="text-red-500 p-2">🗑️</button>`;
        }

        return `<tr class="border-b border-slate-800/50">
            <td class="p-4 text-white text-sm font-bold">${row.subject}</td>
            <td class="p-4 text-center text-[10px] text-blue-400">${row.processed_by_name || "حر"}</td>
            <td class="p-4 flex gap-2 justify-end">${actionBtns}</td>
        </tr>`;
    });

    document.getElementById("desktopList").innerHTML = html.join("");
}

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
