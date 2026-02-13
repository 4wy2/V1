// admin.js - النسخة المطورة (نظام الحذف الذكي + الأمان)
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// 1. التنبيهات الذكية
const notify = (msg, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const themes = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-blue-600' };
    const toast = document.createElement('div');
    toast.className = `${themes[type]} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm mb-2 transition-all duration-500 transform translate-x-0 z-[500]`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { 
        toast.classList.add('opacity-0', '-translate-y-10');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// 2. الدخول والتحقق
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    const { data: admin, error } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();

    if (error || !admin) {
        notify("عذراً، لا تملك صلاحية دخول المشرفين", "error");
        setTimeout(async () => { await supa.auth.signOut(); location.reload(); }, 2000);
        return;
    }

    currentUser = { id: session.user.id, name: admin.full_name, isSuper: !!admin.is_super };
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    
    if (document.getElementById("teamWorkBtn")) {
        currentUser.isSuper ? document.getElementById("teamWorkBtn").classList.remove("hidden") : document.getElementById("teamWorkBtn").classList.add("hidden");
    }

    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[9px] font-black uppercase tracking-widest">${currentUser.isSuper ? '👑 Head Admin' : '🛡️ Reviewer'}</p>
        <p class="text-white font-black text-xl leading-none mt-1">${currentUser.name}</p>`;
    
    loadData();
}

// 3. جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (error) return notify("فشل في جلب البيانات", "error");
    allRows = data || [];
    render();
}

// 4. منطق الحذف (طلب حذف + حذف نهائي)
window.requestDelete = async (id) => {
    if (!confirm("هل أنت متأكد من رغبتك في طلب حذف هذا الملف؟ سيختفي من عندك ويرسل للمدير.")) return;
    const { error } = await supa.from("resources").update({ status: 'delete_requested' }).eq("id", id);
    if (!error) { notify("تم إرسال طلب الحذف", "info"); loadData(); }
};

window.confirmFinalDelete = async (id) => {
    if (!confirm("⚠️ تحذير: سيتم حذف السجل نهائياً من السيرفر. هل أنت متأكد؟")) return;
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (!error) { notify("تم الحذف النهائي بنجاح", "success"); loadData(); }
};

// 5. التحديث العام
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };
    
    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) { notify("تم التحديث بنجاح", "success"); loadData(); }
};

window.updateNote = async (id, note) => { await supa.from("resources").update({ admin_note: note }).eq("id", id); };

// 6. الرندرة والتنسيق المتجاوب
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    
    // الفلترة الذكية: إخفاء طلبات الحذف عن المراجعين إلا لو كان المراجع هو المدير وفي فلتر خاص
    const filtered = allRows.filter(r => {
        const matchesSearch = (r.subject || "").toLowerCase().includes(search) || (r.uploader_name || "").toLowerCase().includes(search);
        
        // إذا كان الملف مطلوب حذفه: لا يظهر للمراجعين أبداً. يظهر فقط للمدير إذا اختار "المعلق" أو إذا أردت إضافة زر فلتر "طلبات الحذف"
        if (r.status === 'delete_requested' && !currentUser.isSuper) return false;
        
        return (currentFilter === "all" || r.status === currentFilter) && matchesSearch;
    });
    
    document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        const typeStyle = { pdf: 'bg-rose-500/10 text-rose-500 border-rose-500/20', png: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }[row.file_type?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

        // بناء الأزرار
        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] font-black transition-all">فتح</a>`;
        
        if (row.status === 'delete_requested' && currentUser.isSuper) {
            btns = `
                <button onclick="confirmFinalDelete(${rId})" class="bg-rose-600 hover:bg-rose-500 text-white px-5 py-3 rounded-xl text-[10px] font-black animate-pulse">تأكيد الحذف النهائي 🔥</button>
                <button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-400 px-2 text-[10px]">تراجع</button>
            `;
        } else if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-3 rounded-xl text-[10px] font-black transition-all">حجز</button>`;
            btns += `<button onclick="requestDelete(${rId})" class="text-rose-500 p-2 hover:bg-rose-500/10 rounded-lg">🗑️</button>`;
        } else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-[10px] font-black shadow-lg">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-500 hover:text-white px-2 py-2 text-[10px]">إلغاء</button>`;
        } else if (row.status === 'reviewing') {
            btns += `<span class="text-[9px] text-slate-500 italic py-2">🔒 بيد ${row.processed_by_name}</span>`;
        }

        const cardContent = `
            <div class="font-black text-white text-base">${row.status === 'delete_requested' ? '⚠️ [مطلوب حذفه] ' : ''}${row.subject}</div>
            <div class="text-[9px] text-slate-500 font-bold mt-3 uppercase tracking-wider">👤 الرافع: ${row.uploader_name || 'غير معروف'}</div>
        `;

        return { 
            desktop: `<tr class="border-b border-slate-800/30 hover:bg-white/[0.01] transition-all ${row.status === 'delete_requested' ? 'bg-rose-900/10' : ''}">
                <td class="p-6">${cardContent}</td>
                <td class="p-6 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black border uppercase ${typeStyle}">${row.file_type || 'File'}</span></td>
                <td class="p-6"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" placeholder="ملاحظة إدارية..." class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none"></td>
                <td class="p-6 text-center text-[10px] font-black uppercase ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-6 flex gap-2 justify-end items-center mt-4">${btns}</td>
            </tr>`, 
            mobile: `<div class="bg-slate-900/40 p-6 rounded-[2.5rem] border ${row.status === 'delete_requested' ? 'border-rose-500/50' : 'border-white/5'} space-y-4 shadow-xl">
                <div class="flex justify-between items-start">
                    <div>${cardContent}</div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black border uppercase ${typeStyle}">${row.file_type || 'FT'}</span>
                </div>
                <input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300" placeholder="ملاحظة الإدارة...">
                <div class="flex gap-2 justify-between pt-4 border-t border-white/5">${btns}</div>
            </div>` 
        };
    });

    document.getElementById("desktopList").innerHTML = items.map(i => i.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(i => i.mobile).join("");
    updateStats();
}

// 7. الإحصائيات (تعديل: استثناء طلبات الحذف من الإحصاء العام)
function updateStats() {
    const validRows = allRows.filter(r => r.status !== 'delete_requested');
    const total = validRows.length, approved = validRows.filter(r => r.status === "approved").length;
    
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    if (document.getElementById("progressBar")) document.getElementById("progressBar").style.width = `${pct}%`;
    if (document.getElementById("progressText")) document.getElementById("progressText").textContent = `${pct}%`;
}

// 8. الأحداث والفلترة
document.getElementById("searchBox")?.addEventListener('input', render);
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl text-slate-400 transition-all");
        btn.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl bg-blue-600 text-white shadow-lg transition-all";
        render();
    };
});

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
