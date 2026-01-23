const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_KEY_HERE"; // يفضل وضعها في متغير بيئة
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = null;

// ================= نظام التنبيهات المحسن =================
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-500 border-emerald-400',
        error: 'bg-red-500 border-red-400',
        info: 'bg-blue-600 border-blue-400'
    };
    toast.className = `${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl border-l-4 animate-bounce-in font-bold text-sm`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ================= إدارة الدخول =================
document.getElementById("loginForm").onsubmit = async (e) => {
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
        showToast("فشل الدخول: " + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.classList.add("hidden");
    }
};

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    currentUser = session.user;
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");

    const { data: admin } = await supa.from("admins").select("*").eq("user_id", currentUser.id).maybeSingle();
    
    document.getElementById("whoami").innerHTML = `
        <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">المشرف الحالي</p>
        <p class="text-xl font-black text-white">${admin?.full_name || currentUser.email.split('@')[0]}</p>
    `;
    
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
        showToast("حدث خطأ أثناء جلب البيانات", 'error');
    }
}

function render() {
    const search = document.getElementById("searchBox").value.toLowerCase();
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));
    
    document.getElementById("totalCount").textContent = filtered.length;
    renderStats();
    
    const desktop = document.getElementById("desktopList");
    const mobile = document.getElementById("mobileList");

    desktop.innerHTML = filtered.map(row => createRowHTML(row, 'desktop')).join("");
    mobile.innerHTML = filtered.map(row => createRowHTML(row, 'mobile')).join("");
}

// ================= مكونات الواجهة (Clean Code) =================
function createRowHTML(row, type) {
    const isMe = row.processed_by_user_id === currentUser.id;
    const isFree = !row.processed_by_user_id;
    const isLocked = !isFree && !isMe;

    const actionButtons = `
        <div class="flex gap-2 w-full justify-end">
            <a href="${row.file_url}" target="_blank" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all">معاينة</a>
            ${isFree && row.status === 'pending' ? `<button onclick="updateAction(${row.id}, 'claim')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold shadow-lg shadow-amber-600/20">حجز</button>` : ''}
            ${isMe && row.status === 'reviewing' ? `<button onclick="updateAction(${row.id}, 'approve')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/20">اعتماد ✅</button>` : ''}
            ${isMe ? `<button onclick="updateAction(${row.id}, 'release')" class="px-4 py-2 text-slate-500 hover:text-white text-[10px]">إلغاء</button>` : ''}
            ${isLocked ? `<span class="text-[10px] text-slate-600 italic">🔒 محجوز لـ ${row.processed_by_name}</span>` : ''}
        </div>
    `;

    if (type === 'desktop') {
        return `
            <tr class="bg-slate-900/40 border border-white/5 backdrop-blur-sm transition-all hover:bg-slate-800/50 group">
                <td class="p-4 rounded-r-2xl font-bold">${row.subject}</td>
                <td class="p-4">
                    <input type="text" value="${row.admin_note || ''}" 
                        onblur="updateNote(${row.id}, this.value)"
                        class="bg-black/20 border border-transparent focus:border-blue-500/50 w-full p-2 rounded-lg text-xs outline-none transition-all"
                        placeholder="أضف ملاحظة...">
                </td>
                <td class="p-4 text-center text-xs text-blue-400/70 font-bold">${row.processed_by_name || '—'}</td>
                <td class="p-4 rounded-l-2xl">${actionButtons}</td>
            </tr>
        `;
    }

    return `
        <div class="p-6 rounded-3xl bg-slate-900/60 border border-white/5 shadow-xl space-y-4">
            <div class="flex justify-between items-start">
                <h3 class="font-black text-lg">${row.subject}</h3>
                <span class="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full">${row.status}</span>
            </div>
            <textarea onblur="updateNote(${row.id}, this.value)" class="w-full bg-black/30 border border-white/5 p-4 rounded-2xl text-sm outline-none" placeholder="ملاحظات المراجعة...">${row.admin_note || ''}</textarea>
            ${actionButtons}
        </div>
    `;
}

// ================= العمليات (Actions) =================
async function updateAction(id, type) {
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">جاري...</span>`;

        let updates = {};
        if (type === 'claim') {
            updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.email.split('@')[0] };
        } else if (type === 'approve') {
            updates = { status: 'approved', updated_at: new Date().toISOString() };
        } else if (type === 'release') {
            updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
        }

        const { error } = await supa.from("resources").update(updates).eq("id", id);
        if (error) throw error;

        showToast("تم تحديث الحالة بنجاح", 'success');
        loadData();
    } catch (err) {
        showToast("فشل التحديث: " + err.message, 'error');
        btn.innerText = originalText;
    } finally {
        btn.disabled = false;
    }
}

async function updateNote(id, note) {
    try {
        const { error } = await supa.from("resources").update({ admin_note: note }).eq("id", id);
        if (error) throw error;
        showToast("تم حفظ الملاحظة تلقائياً", 'info');
    } catch (err) {
        showToast("لم يتم حفظ الملاحظة", 'error');
    }
}

// ================= متفرقات =================
function renderStats() {
    const stats = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === 'approved').length,
        active: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === 'reviewing').length
    };
    document.getElementById("productivityStats").innerHTML = `
        <div class="text-center"><p class="text-[9px] text-slate-500 font-bold">منجز</p><p class="text-xl font-black text-emerald-400">${stats.done}</p></div>
        <div class="w-px h-6 bg-white/10"></div>
        <div class="text-center"><p class="text-[9px] text-slate-500 font-bold">قيد العمل</p><p class="text-xl font-black text-amber-400">${stats.active}</p></div>
    `;
}

document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "shadow-lg"));
        btn.classList.add("bg-blue-600", "shadow-lg");
        render();
    };
});

async function handleLogout() {
    await supa.auth.signOut();
    location.reload();
}

checkUser();
