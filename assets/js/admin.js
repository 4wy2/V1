const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; 
let allRows = [];
let currentFilter = "pending";
let currentAdminName = "";

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // جلب بيانات المشرف
    try {
        const { data: admin } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
        currentAdminName = admin?.full_name || session.user.email.split('@')[0];
    } catch(e) { currentAdminName = session.user.email.split('@')[0]; }

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
    
    // --- منطق التحفيز والإنجاز ---
    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length;
    const myTotalEver = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length;
    const myReviewingNow = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length;

    let rank = "بداية موفقة ☕";
    if(myDoneToday > 5) rank = "أداء بطل! 🔥";
    if(myDoneToday > 15) rank = "أنت نجم اللجنة! ⭐";

    document.getElementById("productivityStats").innerHTML = `
        <h2 class="text-white font-black text-xl">${rank}</h2>
        <p class="text-[11px] text-blue-300 font-bold mt-1 uppercase tracking-wider">
            أنجزت اليوم: ${myDoneToday} &nbsp; | &nbsp; إجمالي بصماتك: ${myTotalEver} &nbsp; | &nbsp; تحت مراجعتك: ${myReviewingNow}
        </p>
    `;
    document.getElementById("totalCount").textContent = allRows.length;

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const getRowHTML = (row) => {
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "";
        const canEdit = isOwner || isUnowned || supabase.auth.user()?.email === SUPER_ADMIN_EMAIL;

        // الأزرار المصلحة
        let actionBtns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black">فتح الملف</a>`;
        
        if (canEdit) {
            if (row.status === 'pending') {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز للمراجعة ✋</button>`;
            } else if (row.status === 'reviewing' && isOwner) {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20">اعتماد (تم) ✨</button>`;
                actionBtns += `<button onclick="releaseLock(${row.id})" class="text-slate-400 border border-slate-700 px-3 py-2 rounded-xl text-[9px]">إلغاء الحجز</button>`;
            } else if (row.status === 'approved') {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب النشر</button>`;
            }
        } else {
            actionBtns += `<span class="text-[9px] text-red-400 italic">🔒 مقفل لـ ${row.processed_by}</span>`;
        }

        return `
        <tr class="archive-item ${!canEdit ? 'locked-row' : ''}">
            <td class="p-5 rounded-r-[1.5rem] border-y border-r border-slate-800">
                <div class="font-black text-sm text-white">${row.subject}</div>
                <div class="text-[10px] text-amber-500 mt-1 italic">📌 وصف الطالب: ${row.description || 'بدون وصف'}</div>
            </td>
            <td class="p-5 border-y border-slate-800">
                <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px]" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-5 border-y border-slate-800 text-center text-[10px] font-bold text-blue-400/40">${row.processed_by || '--'}</td>
            <td class="p-5 rounded-l-[1.5rem] border-y border-l border-slate-800 text-center"><div class="flex gap-2 justify-center">${actionBtns}</div></td>
        </tr>`;
    };

    desktopBody.innerHTML = filtered.map(getRowHTML).join("");
    mobileContainer.innerHTML = filtered.map(row => {
        // نفس المنطق للجوال مع تغيير التنسيق لبطاقات
        return `<div class="archive-item p-6 rounded-[2rem] space-y-4 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-50' : ''}">
            <div class="flex justify-between font-black text-xs text-white"><span>${row.subject}</span><span class="text-blue-500">${row.processed_by || 'متاح'}</span></div>
            <div class="bg-amber-500/5 p-3 rounded-2xl text-[10px] text-amber-500 italic">📝 ${row.description || 'بدون وصف'}</div>
            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-xs h-20" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap">${row.id ? '' : ''} </div>
        </div>`;
    }).join("");
}

// --- وظائف التحديث الجوهري ---
window.updateStatus = async (id, newStatus) => {
    const { error } = await supa.from("resources").update({ 
        status: newStatus, 
        processed_by: currentAdminName,
        updated_at: new Date().toISOString() 
    }).eq("id", id);
    
    if(!error) loadAllRows();
    else alert("علق النظام: " + error.message);
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note, processed_by: currentAdminName }).eq("id", id);
};

window.releaseLock = async (id) => {
    if(confirm("هل تريد فك حجز الملف؟")) {
        await supa.from("resources").update({ processed_by: null, status: 'pending' }).eq("id", id);
        loadAllRows();
    }
};

document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supa.auth.signInWithPassword({ email: e.target[0].value, password: e.target[1].value });
    if (error) alert(error.message); else refreshUI();
};

document.getElementById("logoutBtn").onclick = async () => { await supa.auth.signOut(); location.reload(); };
document.getElementById("searchBox").oninput = renderLists;
document.querySelectorAll(".filterBtn").forEach(btn => btn.onclick = () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
    btn.classList.add("bg-blue-600", "text-white");
    renderLists();
});

refreshUI();
