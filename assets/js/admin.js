// admin.js - النسخة المستقرة للمدير (تظهر فيها طلبات الحذف فوراً)
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// 1. التنبيهات
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

// 2. الدخول
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const btn = e.submitter || loginForm.querySelector('button');
        btn.disabled = true; btn.innerText = "جاري التحقق...";
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) { 
            notify("بيانات الدخول غير صحيحة", "error"); 
            btn.disabled = false; btn.innerText = "دخول النظام"; 
        } else { checkUser(); }
    };
}

// 3. التحقق وإظهار زر الحذف للمدير
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
    
    // إظهار زر الإحصائيات للمدير
    const teamBtn = document.getElementById("teamWorkBtn");
    if (teamBtn) currentUser.isSuper ? teamBtn.classList.remove("hidden") : teamBtn.classList.add("hidden");

    // إضافة زر فلتر "طلبات الحذف" للمدير فقط في الواجهة
    if (currentUser.isSuper && !document.getElementById('delFilterBtn')) {
        const filterParent = document.querySelector('.flex.gap-2.mb-8') || document.querySelector('.filter-container');
        if (filterParent) {
            const btn = document.createElement('button');
            btn.id = 'delFilterBtn';
            btn.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl text-slate-400 transition-all border border-white/5";
            btn.innerText = "⚠️ الحذف";
            btn.onclick = () => {
                currentFilter = "delete_requested";
                document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
                btn.classList.add('bg-rose-600', 'text-white');
                render();
            };
            filterParent.appendChild(btn);
        }
    }

    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[9px] font-black uppercase tracking-widest">${currentUser.isSuper ? '👑 Head Admin' : '🛡️ Reviewer'}</p>
        <p class="text-white font-black text-xl leading-none mt-1">${currentUser.name}</p>`;
    
    loadData();
}

// 4. جلب البيانات
async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
    if (error) return notify("فشل في جلب البيانات", "error");
    allRows = data || [];
    render();
}

// 5. أوامر الحذف
window.requestDelete = async (id) => {
    if (!confirm("إرسال طلب حذف للمدير؟")) return;
    await supa.from("resources").update({ status: 'delete_requested' }).eq("id", id);
    notify("تم الإرسال للمدير", "info"); loadData();
};

window.confirmFinalDelete = async (id) => {
    if (!confirm("حذف نهائي؟ لا يمكن التراجع!")) return;
    await supa.from("resources").delete().eq("id", id);
    notify("تم الحذف بنجاح", "success"); loadData();
};

// 6. التحديث العام
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };
    await supa.from("resources").update(updates).eq("id", id);
    notify("تم التحديث", "success"); loadData();
};

window.updateNote = async (id, note) => { await supa.from("resources").update({ admin_note: note }).eq("id", id); };

// 7. الرندرة (معدلة لتظهر الطلبات للمدير)
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    
    const filtered = allRows.filter(r => {
        const matchesSearch = (r.subject || "").toLowerCase().includes(search);
        
        // إذا كان الملف مطلوب حذفه:
        if (r.status === 'delete_requested') {
            if (!currentUser.isSuper) return false; // الموظف العادي لا يراه أبداً
            // للمدير: يظهر إذا كان الفلتر "الكل" أو "المعلق" أو "طلب حذف"
            return (currentFilter === "all" || currentFilter === "pending" || currentFilter === "delete_requested") && matchesSearch;
        }

        return (currentFilter === "all" || r.status === currentFilter) && matchesSearch;
    });
    
    document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        const typeStyle = { pdf: 'bg-rose-500/10 text-rose-500', png: 'bg-emerald-500/10 text-emerald-500' }[row.file_type?.toLowerCase()] || 'bg-slate-500/10 text-slate-400';

        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600 text-white px-5 py-3 rounded-xl text-[10px] font-black">فتح</a>`;
        
        if (row.status === 'delete_requested' && currentUser.isSuper) {
            btns = `
                <button onclick="confirmFinalDelete(${rId})" class="bg-rose-600 text-white px-5 py-3 rounded-xl text-[10px] font-black animate-pulse">تأكيد الحذف 🔥</button>
                <button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-400 px-2 text-[10px]">إلغاء</button>
            `;
        } else if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-white/5 text-white border border-white/10 px-5 py-3 rounded-xl text-[10px] font-black">حجز</button>`;
            btns += `<button onclick="requestDelete(${rId})" class="text-rose-500 p-2">🗑️</button>`;
        } else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 text-white px-5 py-3 rounded-xl text-[10px] font-black">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-500 px-2 text-[10px]">إلغاء</button>`;
        }

        const cardHeader = `<div class="font-black text-white text-base">${row.status === 'delete_requested' ? '<span class="text-rose-500">⚠️ طلب حذف:</span> ' : ''}${row.subject}</div>`;

        return { 
            desktop: `<tr class="border-b border-slate-800/30 ${row.status === 'delete_requested' ? 'bg-rose-900/20' : ''}">
                <td class="p-6">${cardHeader}<div class="text-[9px] text-slate-500 mt-2">👤 ${row.uploader_name || 'غير معروف'}</div></td>
                <td class="p-6 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black border uppercase ${typeStyle}">${row.file_type || 'File'}</span></td>
                <td class="p-6"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none"></td>
                <td class="p-6 text-center text-[10px] font-black uppercase text-blue-400">${row.processed_by_name || "متاح"}</td>
                <td class="p-6 flex gap-2 justify-end items-center mt-4">${btns}</td>
            </tr>`, 
            mobile: `<div class="bg-slate-900/40 p-6 rounded-[2.5rem] border ${row.status === 'delete_requested' ? 'border-rose-500' : 'border-white/5'} space-y-4">
                <div class="flex justify-between">
                    <div>${cardHeader}<p class="text-[10px] text-slate-500 mt-1">👤 ${row.uploader_name || 'مجهول'}</p></div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black border ${typeStyle}">${row.file_type || 'FT'}</span>
                </div>
                <div class="flex gap-2 justify-between pt-4 border-t border-white/5">${btns}</div>
            </div>` 
        };
    });

    document.getElementById("desktopList").innerHTML = items.map(i => i.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(i => i.mobile).join("");
}

// باقي الدوال (Stats, Logout, Filters) تبقى كما هي في نسختك الشغالة...
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
        if (document.getElementById('delFilterBtn')) document.getElementById('delFilterBtn').classList.remove('bg-rose-600', 'text-white');
        btn.classList.add('bg-blue-600', 'text-white');
        render();
    };
});

window.handleLogout = async () => { await supa.auth.signOut(); location.reload(); };
checkUser();
