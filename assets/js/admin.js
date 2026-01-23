const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; 

let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    // جلب اسم المشرف من جدول الإدارة
    const { data: adminData } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
    currentAdminName = adminData?.full_name || session.user.email.split('@')[0];

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("whoami").textContent = `المشرف: ${currentAdminName}`;
    loadAllRows();
}

async function loadAllRows() {
    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    allRows = data || [];
    renderLists();
}

function renderLists() {
    const desktopBody = document.getElementById("desktopList");
    const mobileContainer = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    // ربط التحفيز باسم المشرف الحالي
    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length;
    const myTotalEver = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length;
    const myReviewingNow = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length;

    // تحديث واجهة التحفيز
    let rank = "بداية موفقة ☕";
    if (myDoneToday > 5) rank = "أداء رهيب! 🚀";
    if (myDoneToday > 15) rank = "أنت أسطورة اليوم! ⭐";

    document.getElementById("productivityStats").innerHTML = `
        <div class="flex flex-col gap-1 text-right">
            <h2 class="text-white font-black text-lg">${rank}</h2>
            <p class="text-[11px] text-blue-300">
                أنجزت اليوم: <span class="text-white font-bold">${myDoneToday}</span> | 
                إجمالي مساهماتك: <span class="text-white font-bold">${myTotalEver}</span> | 
                تحت مراجعتك حالياً: <span class="text-amber-400 font-bold">${myReviewingNow}</span>
            </p>
        </div>
    `;

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const generateHTML = (row, type) => {
        const isSuperAdmin = supabase.auth.user()?.email === SUPER_ADMIN_EMAIL;
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "";
        const canEdit = isOwner || isUnowned || isSuperAdmin;

        // الأزرار المنطقية
        let actionButtons = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black pointer-events-auto">فتح الملف</a>`;

        if (canEdit) {
            if (row.status === 'pending') {
                actionButtons += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black pointer-events-auto">حجز للمراجعة ✋</button>`;
            } else if (row.status === 'reviewing' && isOwner) {
                actionButtons += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black pointer-events-auto shadow-lg shadow-emerald-500/20">اعتماد (تم) ✨</button>`;
                actionButtons += `<button onclick="releaseLock(${row.id})" class="text-slate-400 border border-slate-700 px-3 py-2 rounded-xl text-[9px] pointer-events-auto">فك الحجز</button>`;
            } else if (row.status === 'approved') {
                actionButtons += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black pointer-events-auto">سحب النشر</button>`;
            }
        } else {
            actionButtons += `<span class="text-[9px] text-red-400 italic bg-red-500/5 p-2 rounded-lg">🔒 محجوز لـ ${row.processed_by}</span>`;
        }

        const isLockedClass = (!canEdit) ? 'opacity-40 grayscale-[0.5]' : '';

        if (type === 'desktop') {
            return `
            <tr class="archive-item ${isLockedClass}">
                <td class="p-5 rounded-r-3xl border-y border-r border-slate-800">
                    <div class="font-black text-sm text-white">${row.subject}</div>
                    <div class="text-[10px] text-amber-500 mt-2 italic">📝 ${row.description || 'بدون وصف'}</div>
                </td>
                <td class="p-5 border-y border-slate-800">
                    <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px] ${!canEdit ? 'pointer-events-none' : 'pointer-events-auto'}" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
                </td>
                <td class="p-5 border-y border-slate-800 text-center">
                    <div class="text-[9px] font-bold text-blue-400/40">${row.processed_by || 'متاح'}</div>
                </td>
                <td class="p-5 rounded-l-3xl border-y border-l border-slate-800">
                    <div class="flex gap-2 justify-center">${actionButtons}</div>
                </td>
            </tr>`;
        }
        
        return `
        <div class="archive-item p-6 space-y-4 border border-slate-800 ${isLockedClass}">
            <div class="flex justify-between items-center"><div class="font-black text-white">${row.subject}</div><div class="text-[9px] font-bold text-blue-500/50">${row.processed_by || 'متاح'}</div></div>
            <div class="bg-amber-500/5 p-3 rounded-2xl text-[10px] text-amber-500 italic">📝 نوتة الطالب: ${row.description || 'لا يوجد وصف.'}</div>
            <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-xs h-20 ${!canEdit ? 'pointer-events-none' : 'pointer-events-auto'}" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap">${actionButtons}</div>
        </div>`;
    };

    desktopBody.innerHTML = filtered.map(r => generateHTML(r, 'desktop')).join("");
    mobileContainer.innerHTML = filtered.map(r => generateHTML(r, 'mobile')).join("");
}

// الدوال المساعدة (إصلاح الـ Pointer Events)
window.updateStatus = async (id, newStatus) => {
    let updateObj = { status: newStatus, processed_by: currentAdminName, updated_at: new Date().toISOString() };
    if (newStatus === 'pending') {
        if (confirm("هل تريد إتاحة الملف للجميع؟")) updateObj.processed_by = null;
    }
    await supa.from("resources").update(updateObj).eq("id", id);
    loadAllRows();
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note, processed_by: currentAdminName }).eq("id", id);
    loadAllRows();
};

window.releaseLock = async (id) => {
    await supa.from("resources").update({ processed_by: null, status: 'pending' }).eq("id", id);
    loadAllRows();
};

// تشغيل النظام
refreshUI();
