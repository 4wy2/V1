// admin.js - النسخة الاحترافية الشاملة (دعم الجوال + ميزة الحذف + شغل الشباب)
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

// 3. التحقق من المستخدم وإضافة زر الفلترة للمدير
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
    
    // زر شغل الشباب
    const teamBtn = document.getElementById("teamWorkBtn");
    if (teamBtn) currentUser.isSuper ? teamBtn.classList.remove("hidden") : teamBtn.classList.add("hidden");

    // إضافة زر "طلبات الحذف" للمدير في صفحة التحكم
    if (currentUser.isSuper && !document.getElementById('delFilterBtn')) {
        const filterParent = document.querySelector('.flex.gap-2.mb-8');
        if (filterParent) {
            const btn = document.createElement('button');
            btn.id = 'delFilterBtn';
            btn.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl text-slate-400 transition-all border border-white/5";
            btn.innerText = "⚠️ حذف";
            btn.dataset.filter = "delete_requested";
            btn.onclick = () => {
                currentFilter = "delete_requested";
                document.querySelectorAll(".filterBtn").forEach(b => b.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl text-slate-400 transition-all");
                btn.className = "filterBtn flex-1 py-3 text-xs font-black rounded-xl bg-rose-600 text-white shadow-lg transition-all";
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

// 5. ميزة "شغل الشباب" (تعمل كما هي)
window.showTeamWork = () => {
    const summary = allRows.reduce((acc, row) => {
        if (row.processed_by_name) {
            if (!acc[row.processed_by_name]) acc[row.processed_by_name] = { done: 0, working: 0 };
            row.status === 'approved' ? acc[row.processed_by_name].done++ : acc[row.processed_by_name].working++;
        }
        return acc;
    }, {});

    let html = `
        <div class="fixed inset-0 bg-black/90 backdrop-blur-xl z-[600] p-4 flex items-center justify-center animate-in fade-in duration-300">
            <div class="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-8 relative shadow-2xl overflow-y-auto max-h-[80vh]">
                <button onclick="this.parentElement.parentElement.remove()" class="absolute top-6 left-6 text-slate-500 hover:text-white">✕ إغلاق</button>
                <h2 class="text-2xl font-black mb-6 text-white italic">📊 إنجاز الفريق</h2>
                <div class="space-y-4">`;
    for (const name in summary) {
        html += `
            <div class="flex items-center justify-between bg-white/5 p-5 rounded-2xl border border-white/5">
                <div class="font-bold text-white">${name}</div>
                <div class="flex gap-4 text-center text-xs">
                    <div><p class="text-emerald-400 font-black mb-1">تم</p><p class="text-xl font-black text-white">${summary[name].done}</p></div>
                    <div><p class="text-amber-400 font-black mb-1">حجز</p><p class="text-xl font-black text-white">${summary[name].working}</p></div>
                </div>
            </div>`;
    }
    if (Object.keys(summary).length === 0) html += `<p class="text-center text-slate-500 py-10">لا توجد بيانات متاحة</p>`;
    html += `</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

// 6. ميزة الحذف (المراجع يطلب والمدير ينفذ)
window.requestDelete = async (id) => {
    if (!confirm("هل تريد إرسال طلب حذف للمدير؟")) return;
    await supa.from("resources").update({ status: 'delete_requested' }).eq("id", id);
    notify("تم إرسال الطلب للمدير", "info"); loadData();
};

window.confirmFinalDelete = async (id) => {
    if (!confirm("⚠️ سيتم حذف الملف نهائياً، هل أنت متأكد؟")) return;
    await supa.from("resources").delete().eq("id", id);
    notify("تم الحذف بنجاح", "success"); loadData();
};

// 7. التحديث
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };
    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) { notify("تم التحديث بنجاح", "success"); loadData(); }
};

window.updateNote = async (id, note) => { await supa.from("resources").update({ admin_note: note }).eq("id", id); };

// 8. الرندرة والتنسيق (تعديل منطق الفلترة ليظهر لك طلب الحذف)
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    
    const filtered = allRows.filter(r => {
        const matchesSearch = (r.subject || "").toLowerCase().includes(search) || (r.uploader_name || "").toLowerCase().includes(search);
        
        // منع المراجع العادي من رؤية طلبات الحذف
        if (r.status === 'delete_requested' && !currentUser.isSuper) return false;

        // للمدير: طلب الحذف يظهر في فلتر "الكل" أو فلتر "المعلق" أو فلتر "الحذف"
        const matchesFilter = (currentFilter === "all" || r.status === currentFilter || (currentUser.isSuper && currentFilter === "pending" && r.status === "delete_requested"));

        return matchesFilter && matchesSearch;
    });
    
    document.getElementById("totalCount").textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        const typeStyle = { pdf: 'bg-rose-500/10 text-rose-500 border-rose-500/20', png: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }[row.file_type?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] font-black transition-all text-center">فتح</a>`;
        
        // منطق أزرار الحذف
        if (row.status === 'delete_requested' && currentUser.isSuper) {
            btns = `
                <button onclick="confirmFinalDelete(${rId})" class="bg-rose-600 text-white px-5 py-3 rounded-xl text-[10px] font-black animate-pulse">تأكيد الحذف 🔥</button>
                <button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-500 px-2 py-2 text-[10px]">تراجع</button>
            `;
        } else if (row.status === 'pending') {
            btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-3 rounded-xl text-[10px] font-black transition-all">حجز</button>`;
            btns += `<button onclick="requestDelete(${rId})" class="text-rose-500 p-2 hover:bg-rose-500/10 rounded-lg">🗑️</button>`;
        } else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-emerald-600/20">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-500 hover:text-white px-2 py-2 text-[10px]">إلغاء</button>`;
        } else if (row.status === 'reviewing') btns += `<span class="text-[9px] text-slate-500 italic py-2">🔒 بيد ${row.processed_by_name}</span>`;

        const studentNote = row.note ? `
            <div class="mt-3 p-3 bg-amber-400/5 border border-amber-400/20 rounded-2xl flex gap-3 items-start">
                <span class="text-sm">💬</span>
                <div class="text-[11px] text-slate-300 leading-relaxed">
                    <b class="text-amber-500 block text-[8px] uppercase italic">ملاحظة الطالب:</b> ${row.note}
                </div>
            </div>` : '';

        const statusLabel = row.status === 'delete_requested' ? '<span class="text-rose-500 font-black">[طلب حذف]</span> ' : '';

        return { 
            desktop: `<tr class="border-b border-slate-800/30 hover:bg-white/[0.01] ${row.status === 'delete_requested' ? 'bg-rose-900/10' : ''}">
                <td class="p-6">
                    <div class="font-black text-white text-base">${statusLabel}${row.subject}</div>
                    ${studentNote}
                    <div class="text-[9px] text-slate-500 font-bold mt-3 uppercase tracking-wider">👤 الرافع: ${row.uploader_name || 'غير معروف'}</div>
                </td>
                <td class="p-6 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black border uppercase ${typeStyle}">${row.file_type || 'File'}</span></td>
                <td class="p-6"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" placeholder="ملاحظة إدارية..." class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:border-blue-500 outline-none transition-all"></td>
                <td class="p-6 text-center text-[10px] font-black uppercase ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-6 flex gap-2 justify-end items-center h-full mt-4">${btns}</td>
            </tr>`, 
            mobile: `<div class="bg-slate-900/40 p-6 rounded-[2.5rem] border ${row.status === 'delete_requested' ? 'border-rose-500' : 'border-white/5'} space-y-4 shadow-xl">
                <div class="flex justify-between items-start">
                    <div><h3 class="font-black text-white text-base">${statusLabel}${row.subject}</h3><p class="text-[10px] text-slate-500 font-bold mt-1 tracking-tight">👤 ${row.uploader_name || 'مجهول'}</p></div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black border uppercase ${typeStyle}">${row.file_type || 'FT'}</span>
                </div>
                ${studentNote}
                <input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300" placeholder="ملاحظة الإدارة...">
                <div class="flex gap-2 justify-between pt-4 border-t border-white/5">${btns}</div>
            </div>` 
        };
    });

    document.getElementById("desktopList").innerHTML = items.map(i => i.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(i => i.mobile).join("");
    updateStats();
}

// 9. الإحصائيات (تعمل كما هي)
function updateStats() {
    const total = allRows.length, approved = allRows.filter(r => r.status === "approved").length;
    const mine = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    const statsDiv = document.getElementById("productivityStats");
    if (statsDiv) statsDiv.innerHTML = `
        <div class="text-center"><p class="text-[8px] text-emerald-400 font-black mb-1 uppercase">إنجازك</p><p class="text-2xl font-black text-white">${mine.done}</p></div>
        <div class="w-px h-8 bg-slate-800 mx-4"></div>
        <div class="text-center"><p class="text-[8px] text-amber-400 font-black mb-1 uppercase">حجزك</p><p class="text-2xl font-black text-white">${mine.pending}</p></div>`;
    
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    if (document.getElementById("progressBar")) document.getElementById("progressBar").style.width = `${pct}%`;
    if (document.getElementById("progressText")) document.getElementById("progressText").textContent = `${pct}%`;
}

// 10. الفلترة والخروج
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
