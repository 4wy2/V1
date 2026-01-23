const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; 
let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 
let currentAdminEmail = "";

// 1. الدخول وثبات الاسم
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
    
    // تثبيت الاسم في الهيدر
    document.getElementById("whoami").innerHTML = `
        <span class="text-blue-400 opacity-70">مرحباً بك:</span>
        <span class="text-white font-black ml-2">${currentAdminName}</span>
    `;
    
    loadAllRows();
}

async function loadAllRows() {
    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    allRows = data || [];
    renderLists();
}

// 2. نظام الإنجاز والتحفيز (مرتبط باسمك)
function updateStats() {
    const today = new Date().toLocaleDateString();
    const doneToday = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length;
    const totalEver = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length;
    const inReview = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length;

    document.getElementById("productivityStats").innerHTML = `
        <div class="flex flex-col gap-1 text-right">
            <h2 class="text-white font-black text-xl">لوحة الإنجاز 🏆</h2>
            <p class="text-[11px] text-blue-300 font-bold uppercase">
                اليوم: <span class="text-white">${doneToday}</span> | 
                الإجمالي: <span class="text-white">${totalEver}</span> | 
                تحت يدك الآن: <span class="text-amber-400 font-black">${inReview}</span>
            </p>
        </div>
    `;
}

// 3. تنظيم الأزرار والتصميم
function renderLists() {
    updateStats();
    const desktopBody = document.getElementById("desktopList");
    const mobileContainer = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const getButtons = (row) => {
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "" || row.processed_by === "--";
        const isSuper = currentAdminEmail === SUPER_ADMIN_EMAIL;

        let btns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح الملف</a>`;

        if (isUnowned || isSuper) {
            if (row.status === 'pending') {
                btns += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">حجز للمراجعة ✋</button>`;
            }
        }

        if (isOwner || isSuper) {
            if (row.status === 'reviewing') {
                btns += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">اعتماد ونشر ✅</button>`;
                btns += `<button onclick="releaseLock(${row.id})" class="text-slate-400 border border-slate-700 px-3 py-2 rounded-xl text-[9px]">إلغاء</button>`;
            } else if (row.status === 'approved') {
                btns += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب النشر</button>`;
            }
        } else if (!isUnowned && !isOwner) {
            btns += `<span class="text-[9px] text-red-400 bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10 italic">🔒 مقفل لـ ${row.processed_by}</span>`;
        }
        return btns;
    };

    desktopBody.innerHTML = filtered.map(row => `
        <tr class="archive-item ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-40' : ''}">
            <td class="p-4 rounded-r-3xl border-y border-r border-slate-800">
                <div class="font-black text-xs text-white">${row.subject}</div>
                <div class="text-[9px] text-amber-500 bg-amber-500/5 p-2 rounded-lg mt-2 italic">📌 نوتة الطالب: ${row.description || 'لا يوجد وصف'}</div>
            </td>
            <td class="p-4 border-y border-slate-800">
                <textarea onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px]" placeholder="اكتب ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-4 border-y border-slate-800 text-center font-bold text-[10px] text-blue-400/50">${row.processed_by || '--'}</td>
            <td class="p-4 rounded-l-3xl border-y border-l border-slate-800"><div class="flex gap-2 justify-center">${getButtons(row)}</div></td>
        </tr>
    `).join("");

    mobileContainer.innerHTML = filtered.map(row => `
        <div class="archive-item p-6 rounded-[2rem] space-y-4 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-50' : ''}">
            <div class="flex justify-between items-center"><span class="font-black text-white text-sm">${row.subject}</span><span class="text-[9px] text-blue-500 font-bold">${row.processed_by || 'متاح'}</span></div>
            <div class="bg-amber-500/5 p-3 rounded-2xl text-[10px] text-amber-500 italic border-r-2 border-amber-500/30">📝 ${row.description || 'لا يوجد وصف.'}</div>
            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-xs h-20" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap pt-2">${getButtons(row)}</div>
        </div>
    `).join("");
}

// 4. الدوال التقنية (تحديثات السيرفر)
window.updateStatus = async (id, newStatus) => {
    const { error } = await supa.from("resources").update({ 
        status: newStatus, 
        processed_by: currentAdminName,
        updated_at: new Date().toISOString() 
    }).eq("id", id);
    if (!error) loadAllRows();
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note, processed_by: currentAdminName }).eq("id", id);
};

window.releaseLock = async (id) => {
    await supa.from("resources").update({ processed_by: null, status: 'pending' }).eq("id", id);
    loadAllRows();
};

// تشغيل النظام
refreshUI();
