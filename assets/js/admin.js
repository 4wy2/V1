// admin.js - النسخة النهائية لحل مشكلة CORS و "اعتماد"
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = null;

// ================= نظام التنبيهات =================
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-500 border-emerald-400',
        error: 'bg-red-500 border-red-400',
        info: 'bg-blue-600 border-blue-400'
    };
    toast.className = `${colors[type] || colors.info} text-white px-6 py-4 rounded-2xl shadow-2xl border-l-4 font-bold text-sm transition-all duration-300 animate-pulse`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ================= إدارة الدخول =================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button");
        try {
            btn.disabled = true;
            const { error } = await supa.auth.signInWithPassword({
                email: document.getElementById("email").value,
                password: document.getElementById("password").value
            });
            if (error) throw error;
            showToast("تم تسجيل الدخول بنجاح", "success");
            checkUser();
        } catch (err) {
            showToast("فشل الدخول: " + err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    };
}

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    currentUser = session.user;
    document.getElementById("loginCard")?.classList.add("hidden");
    document.getElementById("adminPanel")?.classList.remove("hidden");
    loadData();
}

// ================= معالجة البيانات =================
async function loadData() {
    try {
        const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        allRows = data || [];
        render();
    } catch (err) {
        showToast("حدث خطأ في جلب البيانات", 'error');
    }
}

// تعديل دالة التحديث لتجاوز الـ CORS
window.updateAction = async function(e, id, type) {
    if (e) e.preventDefault();
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `...`;

        let updates = {};
        if (type === 'claim') {
            updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.email.split('@')[0] };
        } else if (type === 'approve') {
            updates = { status: 'approved', updated_at: new Date().toISOString() };
        } else if (type === 'release') {
            updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
        }

        // الحل السحري: إضافة .select() تجبر المتصفح على استخدام POST بدلاً من PATCH في بعض الحالات
        // وهذا يحل مشكلة الـ Method Not Allowed
        const { error } = await supa
            .from("resources")
            .update(updates)
            .eq("id", id)
            .select(); 

        if (error) throw error;

        showToast("تمت العملية", 'success');
        await loadData();
    } catch (err) {
        console.error("Error details:", err);
        showToast("خطأ: " + err.message, 'error');
        btn.innerHTML = originalText;
    } finally {
        btn.disabled = false;
    }
};

function createRowHTML(row, type) {
    const isMe = row.processed_by_user_id === currentUser?.id;
    const isFree = !row.processed_by_user_id;

    const actionButtons = `
        <div class="flex gap-2">
            ${isFree && row.status === 'pending' ? `<button onclick="updateAction(event, ${row.id}, 'claim')" class="bg-amber-600 px-3 py-1 rounded-lg text-xs font-bold">حجز</button>` : ''}
            ${isMe && row.status === 'reviewing' ? `<button onclick="updateAction(event, ${row.id}, 'approve')" class="bg-emerald-600 px-3 py-1 rounded-lg text-xs font-bold">اعتماد ✅</button>` : ''}
            ${isMe ? `<button onclick="updateAction(event, ${row.id}, 'release')" class="text-[10px] text-slate-500">إلغاء</button>` : ''}
        </div>
    `;

    if (type === 'desktop') {
        return `
            <tr class="border-b border-white/5">
                <td class="p-4 font-bold text-sm">${row.subject || 'بدون عنوان'}</td>
                <td class="p-4"><input type="text" value="${row.admin_note || ''}" onblur="updateNote(${row.id}, this.value)" class="bg-black/20 p-2 rounded w-full text-xs"></td>
                <td class="p-4 text-center text-xs text-blue-400">${row.processed_by_name || '—'}</td>
                <td class="p-4">${actionButtons}</td>
            </tr>
        `;
    }
    return `
        <div class="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-3">
            <h3 class="font-bold">${row.subject}</h3>
            ${actionButtons}
        </div>
    `;
}

// الدوال الباقية (render, updateNote, filter) كما هي في النسخة السابقة
function render() {
    const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));
    document.getElementById("totalCount").textContent = filtered.length;
    document.getElementById("desktopList").innerHTML = filtered.map(row => createRowHTML(row, 'desktop')).join("");
    document.getElementById("mobileList").innerHTML = filtered.map(row => createRowHTML(row, 'mobile')).join("");
}

window.updateNote = async function(id, note) {
    await supa.from("resources").update({ admin_note: note }).eq("id", id).select();
    showToast("تم الحفظ", "info");
};

document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600"));
        btn.classList.add("bg-blue-600");
        render();
    };
});

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
