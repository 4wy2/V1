const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; 

let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 
let currentAdminEmail = "";

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    currentAdminEmail = session.user.email;
    const { data: adminData } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
    currentAdminName = adminData?.full_name || currentAdminEmail.split('@')[0];

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("whoami").textContent = `المشرف: ${currentAdminName}`;
    loadAllRows();
}

// تفعيل زر تسجيل الخروج
document.getElementById("logoutBtn").onclick = async () => {
    if(confirm("هل تريد الخروج؟")) {
        await supa.auth.signOut();
        location.reload();
    }
};

async function loadAllRows() {
    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    allRows = data || [];
    renderLists();
}

function renderLists() {
    const desktopBody = document.getElementById("desktopList");
    const mobileContainer = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    // حساب الإنجازات والتحفيز
    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length;
    const myTotalEver = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length;

    let rank = "بداية موفقة ☕";
    if (myDoneToday > 5) rank = "أداء رهيب! 🚀";
    if (myDoneToday > 15) rank = "أنت أسطورة اليوم! ⭐";

    document.getElementById("productivityStats").innerHTML = `
        <h2 class="text-white font-black text-lg">${rank}</h2>
        <p class="text-[11px] text-blue-300">أنجزت اليوم: ${myDoneToday} | إجمالي بصماتك: ${myTotalEver}</p>
    `;
    document.getElementById("totalCount").textContent = allRows.length;

    const generateHTML = (row, type) => {
        const isSuperAdmin = currentAdminEmail === SUPER_ADMIN_EMAIL;
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "";
        const canEdit = isOwner || isUnowned || isSuperAdmin;

        let statusBadge = row.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' : 
                          row.status === 'reviewing' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-700/50 text-slate-400';
        let statusText = row.status === 'approved' ? 'تم النشر ✅' : 
                         row.status === 'reviewing' ? 'قيد المراجعة ⏳' : 'بانتظار البدء';

        const btns = `
            <div class="flex flex-wrap gap-2 justify-center">
                <a href="${row.file_url}" target="_blank" class="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black">فتح الملف</a>
                ${canEdit ? `
                    ${row.status === 'pending' ? `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز للمراجعة</button>` : ''}
                    ${row.status === 'reviewing' ? `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20">اعتماد ونشر (تم)</button>` : ''}
                    ${row.status === 'approved' ? `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب النشر</button>` : ''}
                    ${!isUnowned ? `<button onclick="releaseLock(${row.id})" class="text-slate-400 border border-slate-800 px-3 py-2 rounded-xl text-[9px]">فك القفل 🔓</button>` : ''}
                ` : `<span class="text-[9px] text-red-400 italic">🔒 مقفل بواسطة ${row.processed_by}</span>`}
            </div>`;

        if (type === 'desktop') {
            return `
            <tr class="archive-item ${!canEdit ? 'locked-row' : ''}">
                <td class="p-5 rounded-r-[1.5rem] border-y border-r border-slate-800">
                    <div class="font-black text-sm text-white">${row.subject}</div>
                    <div class="text-[10px] text-amber-500 bg-amber-500/5 p-2 rounded-lg mt-2 italic">📌 ${row.description || 'بدون وصف'}</div>
                </td>
                <td class="p-5 border-y border-slate-800">
                    <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px]" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
                </td>
                <td class="p-5 border-y border-slate-800 text-center">
                    <div class="px-3 py-1.5 rounded-full font-black text-[9px] inline-block ${statusBadge}">${statusText}</div>
                    <div class="text-[9px] mt-2 font-bold text-blue-400/40">${row.processed_by || '--'}</div>
                </td>
                <td class="p-5 rounded-l-[1.5rem] border-y border-l border-slate-800">${btns}</td>
            </tr>`;
        }
        return `
        <div class="archive-item p-6 space-y-4 shadow-xl border border-slate-800 ${!canEdit ? 'locked-row' : ''}">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div class="px-3 py-1 rounded-full font-black text-[9px] ${statusBadge}">${statusText}</div>
                <div class="text-[9px] font-bold text-blue-500/50">${row.processed_by || 'متاح'}</div>
            </div>
            <div class="font-black text-base text-white">${row.subject}</div>
            <div class="bg-amber-500/5 p-4 rounded-2xl text-[11px] text-amber-500 leading-relaxed italic border-r-4 border-amber-500/30 shadow-inner">📝 وصف الطالب: ${row.description || 'لا يوجد وصف.'}</div>
            <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-xs h-24 shadow-inner" placeholder="اكتب ملاحظة اللجنة العلمية هنا...">${row.admin_note || ''}</textarea>
            <div class="pt-2">${btns}</div>
        </div>`;
    };

    desktopBody.innerHTML = filtered.map(r => generateHTML(r, 'desktop')).join("");
    mobileContainer.innerHTML = filtered.map(r => generateHTML(r, 'mobile')).join("");
}

window.updateStatus = async (id, newStatus) => {
    let updateObj = { status: newStatus, processed_by: currentAdminName, updated_at: new Date().toISOString() };
    if (newStatus === 'pending') {
        if (confirm("تم سحب النشر. هل تريد فك قفل الملف لإتاحته للآخرين؟")) updateObj.processed_by = null;
    }
    await supa.from("resources").update(updateObj).eq("id", id);
    loadAllRows();
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note, processed_by: currentAdminName, updated_at: new Date().toISOString() }).eq("id", id);
    loadAllRows();
};

window.releaseLock = async (id) => {
    if(confirm("هل تريد فك القفل لتمكين مشرف آخر من تعديل الملف؟")) {
        await supa.from("resources").update({ processed_by: null }).eq("id", id);
        loadAllRows();
    }
};

document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supa.auth.signInWithPassword({ email: document.getElementById("email").value, password: document.getElementById("password").value });
    if (error) alert("خطأ: " + error.message);
    refreshUI();
};
document.getElementById("searchBox").oninput = renderLists;
document.querySelectorAll(".filterBtn").forEach(btn => btn.onclick = () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white", "shadow-lg"));
    btn.classList.add("bg-blue-600", "text-white", "shadow-lg");
    renderLists();
});
refreshUI();
