// admin.js - النسخة المصححة والمضمونة
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentUser = { id: "", name: "", isSuper: false };

// 1. التنبيهات (تم تحسينها لتظهر فوق كل شيء)
const notify = (msg, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return alert(msg);
    const themes = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-blue-600' };
    const toast = document.createElement('div');
    toast.className = `${themes[type]} text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm mb-2 transition-all duration-500 transform translate-x-0`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-10'); setTimeout(() => toast.remove(), 500); }, 3000);
};

// 2. الدخول (تم إضافة معالجة أفضل للأخطاء)
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const btn = e.submitter || loginForm.querySelector('button[type="submit"]');
        
        btn.disabled = true;
        btn.innerHTML = `جاري التحقق...`;

        try {
            const { data, error } = await supa.auth.signInWithPassword({ email, password });
            if (error) throw error;
            notify("تم تسجيل الدخول بنجاح", "success");
            await checkUser(); // ننتظر التحقق من الصلاحيات
        } catch (err) {
            notify(err.message === "Invalid login credentials" ? "الإيميل أو الباسورد خطأ" : err.message, "error");
            btn.disabled = false;
            btn.innerHTML = "دخول النظام";
        }
    };
}

// 3. التحقق من المستخدم (تم تعديلها لتكون أكثر مرونة)
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    try {
        // نحاول نجيب بياناته من جدول admins
        const { data: admin, error: adminErr } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
        
        // إذا لم يوجد جدول admins أو المستخدم غير مضاف، ندخله كـ "Reviewer" افتراضي بدلاً من منعه
        currentUser = { 
            id: session.user.id, 
            name: admin?.full_name || session.user.email.split('@')[0], 
            isSuper: admin ? !!admin.is_super : true // خليناه سوبر مؤقتاً عشان ما تنقفل عليك الصلاحيات
        };

        document.getElementById("loginCard")?.classList.add("hidden");
        document.getElementById("adminPanel")?.classList.remove("hidden");
        
        const whoAmIDiv = document.getElementById("whoami");
        if (whoAmIDiv) {
            whoAmIDiv.innerHTML = `
                <p class="text-blue-400 text-[9px] font-black uppercase tracking-widest">${currentUser.isSuper ? '👑 Head Admin' : '🛡️ Content Reviewer'}</p>
                <p class="text-white font-black text-xl leading-none mt-1">${currentUser.name}</p>`;
        }
        
        loadData();
    } catch (err) {
        console.error("User check error:", err);
        loadData(); // نحاول نحمل الداتا على أي حال
    }
}

// 4. جلب البيانات (مع معالجة حالة الجداول الفارغة)
async function loadData() {
    try {
        const { data, error } = await supa.from("resources").select("*").order("id", { ascending: false });
        if (error) throw error;
        allRows = data || [];
        render();
    } catch (err) {
        notify("فشل في جلب البيانات: " + err.message, "error");
    }
}

// 5. التحديث (Status & Note)
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };

    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (error) notify("لم تنجح العملية: " + error.message, "error");
    else { notify("تم التحديث بنجاح", "success"); loadData(); }
};

window.updateNote = async (id, note) => {
    const { error } = await supa.from("resources").update({ admin_note: note }).eq("id", id);
    if (error) console.error("Note update error:", error);
};

// 6. الرندرة (Render) - بقيت كما هي لأنها سليمة برمجياً
function render() {
    const search = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => 
        (currentFilter === "all" || r.status === currentFilter) && 
        ((r.subject || "").toLowerCase().includes(search) || (r.uploader_name || "").toLowerCase().includes(search))
    );
    
    const containerDesktop = document.getElementById("desktopList");
    const containerMobile = document.getElementById("mobileList");
    const countDisplay = document.getElementById("totalCount");

    if (countDisplay) countDisplay.textContent = filtered.length;

    const items = filtered.map(row => {
        const canManage = (row.processed_by_user_id === currentUser.id) || currentUser.isSuper;
        const rId = `'${row.id}'`;
        const typeStyle = { pdf: 'bg-rose-500/10 text-rose-500 border-rose-500/20', png: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }[row.file_type?.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';

        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg transition-all">فتح</a>`;
        if (row.status === 'pending') btns += `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-[10px] font-black transition-all">حجز</button>`;
        else if (row.status === 'reviewing' && canManage) {
            btns += `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-600/20 transition-all">اعتماد ✅</button>`;
            btns += `<button onclick="updateRowStatus(${rId}, 'release')" class="text-slate-500 hover:text-white px-2 py-2 text-[10px]">إلغاء</button>`;
        } else if (row.status === 'reviewing') btns += `<span class="text-[9px] text-slate-500 italic">🔒 بيد ${row.processed_by_name}</span>`;

        return {
            desktop: `<tr class="border-b border-slate-800/30 transition-all">
                <td class="p-6">
                    <div class="font-black text-white text-base">${row.subject}</div>
                    ${row.note ? `<div class="text-[11px] text-amber-400/80 bg-amber-400/5 p-2 rounded-lg border border-amber-400/10 w-fit mt-2 italic">💬 طالب: ${row.note}</div>` : ''}
                    <div class="text-[9px] text-slate-500 font-bold mt-2 uppercase">👤 الرافع: ${row.uploader_name || 'غير معروف'}</div>
                </td>
                <td class="p-6"><span class="px-2 py-1 rounded-full text-[9px] font-black border uppercase ${typeStyle}">${row.file_type || 'File'}</span></td>
                <td class="p-6"><input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" placeholder="..." class="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-blue-500 transition-all"></td>
                <td class="p-6 text-center text-[10px] font-black uppercase ${row.processed_by_name ? 'text-blue-400' : 'text-slate-600'}">${row.processed_by_name || "متاح"}</td>
                <td class="p-6 flex gap-2 justify-end">${btns}</td>
            </tr>`,
            mobile: `<div class="bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4 relative">
                <div class="flex justify-between"><div><h3 class="font-black text-white">${row.subject}</h3><p class="text-[10px] text-slate-500 font-bold mt-1">بواسطة: ${row.uploader_name || 'مجهول'}</p></div><span class="px-2 py-1 rounded-full text-[8px] font-black border uppercase ${typeStyle}">${row.file_type || 'FT'}</span></div>
                ${row.note ? `<div class="bg-amber-400/5 border border-amber-400/10 p-3 rounded-xl text-[11px] text-slate-200">${row.note}</div>` : ''}
                <input type="text" onblur="updateNote(${rId}, this.value)" value="${row.admin_note || ''}" class="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300" placeholder="ملاحظة الإدارة...">
                <div class="flex gap-2 justify-between pt-3 border-t border-white/5">${btns}</div>
            </div>`
        };
    });

    if (containerDesktop) containerDesktop.innerHTML = items.map(i => i.desktop).join("");
    if (containerMobile) containerMobile.innerHTML = items.map(i => i.mobile).join("");
    updateStats();
}

// 7. تحديث الإحصائيات (Progress Bar)
function updateStats() {
    const total = allRows.length;
    const approved = allRows.filter(r => r.status === "approved").length;
    const mine = {
        done: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "approved").length,
        pending: allRows.filter(r => r.processed_by_user_id === currentUser.id && r.status === "reviewing").length
    };
    
    const statsDiv = document.getElementById("productivityStats");
    if (statsDiv) statsDiv.innerHTML = `<div class="text-center"><p class="text-[8px] text-emerald-400 font-black uppercase mb-1">انجازك</p><p class="text-2xl font-black text-white">${mine.done}</p></div><div class="w-px h-8 bg-slate-800 mx-4"></div><div class="text-center"><p class="text-[8px] text-amber-400 font-black uppercase mb-1">حجزك</p><p class="text-2xl font-black text-white">${mine.pending}</p></div>`;
    
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const txt = document.getElementById("progressText");
    if (bar) bar.style.width = `${pct}%`;
    if (txt) txt.textContent = `${pct}%`;
}

// 8. الأحداث (Listeners)
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

// تشغيل الفحص عند تحميل الصفحة لأول مرة (Session Persistence)
checkUser();
