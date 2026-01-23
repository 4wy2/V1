// admin.js - النسخة المتوافقة مع بنية جدولك الحالية
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
        const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
        if (error) throw error;
        allRows = data || [];
        render();
    } catch (err) {
        showToast("حدث خطأ أثناء جلب البيانات", 'error');
    }
}

// دالة التحديث المعدلة لتناسب أعمدة جدولك
window.updateAction = async function(e, id, type) {
    if (e) e.preventDefault();
    const btn = e.currentTarget;
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">...</span>`;

        let updates = {};
        if (type === 'claim') {
            updates = { 
                status: 'reviewing', 
                processed_by_user_id: currentUser.id, 
                processed_by_name: currentUser.email.split('@')[0] 
            };
        } else if (type === 'approve') {
            updates = { status: 'approved' }; // تم إزالة updated_at لأنها غير موجودة في جدولك
        } else if (type === 'release') {
            updates = { 
                status: 'pending', 
                processed_by_user_id: null, 
                processed_by_name: null 
            };
        }

        // استخدام .select() ضروري لتجاوز قيود CORS (PATCH) في المتصفح
        const { error } = await supa.from("resources")
            .update(updates)
            .eq("id", id)
            .select();

        if (error) throw error;

        showToast("تمت العملية بنجاح", 'success');
        await loadData(); 
    } catch (err) {
        console.error("Technical Error:", err);
        showToast("فشل: " + err.message, 'error');
        btn.innerHTML = originalHTML;
    } finally {
        btn.disabled = false;
    }
};

function createRowHTML(row, type) {
    const isMe = row.processed_by_user_id === currentUser?.id;
    const isFree = !row.processed_by_user_id;
    const isLocked = !isFree && !isMe;

    const actionButtons = `
        <div class="flex gap-2 w-full justify-end">
            <a href="${row.file_url}" target="_blank" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all">معاينة</a>
            ${isFree && row.status === 'pending' ? `<button onclick="updateAction(event, ${row.id}, 'claim')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold">حجز</button>` : ''}
            ${isMe && row.status === 'reviewing' ? `<button onclick="updateAction(event, ${row.id}, 'approve')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/20">اعتماد ✅</button>` : ''}
            ${isMe ? `<button onclick="updateAction(event, ${row.id}, 'release')" class="px-4 py-2 text-slate-500 hover:text-white text-[10px]">إلغاء</button>` : ''}
            ${isLocked ? `<span class="text-[10px] text-slate-600 italic">🔒 محجوز لـ ${row.processed_by_name}</span>` : ''}
        </div>
    `;

    if (type === 'desktop') {
        return `
            <tr class="bg-slate-900/40 border border-white/5 backdrop-blur-sm hover:bg-slate-800/50">
                <td class="p-4 font-bold text-sm text-white">${row.subject || 'بدون عنوان'}</td>
                <td class="p-4">
                    <input type="text" value="${row.admin_note || ''}" 
                        onblur="updateNote(${row.id}, this.value)"
                        class="bg-black/20 border border-transparent focus:border-blue-500/50 w-full p-2 rounded-lg text-xs outline-none transition-all">
                </td>
                <td class="p-4 text-center text-xs text-blue-400 font-bold">${row.processed_by_name || '—'}</td>
                <td class="p-4">${actionButtons}</td>
            </tr>
        `;
    }

    return `
        <div class="p-6 rounded-3xl bg-slate-900/60 border border-white/5 shadow-xl space-y-4">
            <div class="flex justify-between items-start">
                <h3 class="font-black text-lg">${row.subject || 'بدون عنوان'}</h3>
                <span class="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full">${row.status}</span>
            </div>
            <textarea onblur="updateNote(${row.id}, this.value)" class="w-full bg-black/30 border border-white/5 p-4 rounded-2xl text-sm outline-none">${row.admin_note || ''}</textarea>
            ${actionButtons}
        </div>
    `;
}

// بقية الدوال
function render() {
    const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));
    
    document.getElementById("totalCount").textContent = filtered.length;
    renderStats();
    
    document.getElementById("desktopList").innerHTML = filtered.map(row => createRowHTML(row, 'desktop')).join("");
    document.getElementById("mobileList").innerHTML = filtered.map(row => createRowHTML(row, 'mobile')).join("");
}

window.updateNote = async function(id, note) {
    try {
        await supa.from("resources").update({ admin_note: note }).eq("id", id).select();
        showToast("تم حفظ الملاحظة", 'info');
    } catch (err) { showToast("لم يتم الحفظ", 'error'); }
};

function renderStats() {
    if (!currentUser) return;
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === 'approved').length,
        active: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === 'reviewing').length
    };
    const statsDiv = document.getElementById("productivityStats");
    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="text-center"><p class="text-[9px] text-slate-500 uppercase">منجز</p><p class="text-xl font-black text-emerald-400">${stats.done}</p></div>
            <div class="w-px h-6 bg-white/10 mx-4"></div>
            <div class="text-center"><p class="text-[9px] text-slate-500 uppercase">قيد المراجعة</p><p class="text-xl font-black text-amber-400">${stats.active}</p></div>
        `;
    }
}

document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
        btn.classList.add("bg-blue-600", "text-white");
        render();
    };
});

const sBox = document.getElementById("searchBox");
if (sBox) sBox.addEventListener("input", render);

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
