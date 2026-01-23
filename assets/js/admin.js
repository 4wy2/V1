const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; 
let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 
let currentAdminEmail = "";

// دالة الدخول الذكية - تمنع التعليق
async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    
    if (!session) {
        document.getElementById("loginCard").classList.remove("hidden");
        document.getElementById("adminPanel").classList.add("hidden");
        return;
    }

    // تأمين الدخول حتى لو فشل جلب الاسم الصريح
    currentAdminEmail = session.user.email;
    try {
        const { data: adminData } = await supa.from("admins")
            .select("full_name")
            .eq("user_id", session.user.id)
            .maybeSingle();
        
        currentAdminName = adminData?.full_name || currentAdminEmail.split('@')[0];
    } catch (e) {
        currentAdminName = currentAdminEmail.split('@')[0];
    }

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("whoami").textContent = `المشرف: ${currentAdminName}`;
    
    // جلب البيانات فور الدخول
    loadAllRows();
}

// معالجة تسجيل الدخول
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supa.auth.signInWithPassword({ email, password });

    if (error) {
        alert("فشل الدخول: " + error.message);
    } else {
        refreshUI();
    }
};

// جلب وعرض البيانات
async function loadAllRows() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (error) {
        console.error("خطأ في جلب البيانات:", error);
        return;
    }
    allRows = data || [];
    renderLists();
}

function renderLists() {
    const desktopBody = document.getElementById("desktopList");
    const mobileContainer = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    // ربط التحفيز بالاسم الحالي
    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length;
    const myTotalEver = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length;
    const myReviewingNow = allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length;

    document.getElementById("productivityStats").innerHTML = `
        <div class="text-right">
            <h2 class="text-white font-black text-lg">أهلاً ${currentAdminName} 👋</h2>
            <p class="text-[11px] text-blue-300">
                إنجاز اليوم: <span class="text-white font-bold">${myDoneToday}</span> | 
                الإجمالي: <span class="text-white font-bold">${myTotalEver}</span> | 
                تحت المراجعة: <span class="text-amber-400 font-bold">${myReviewingNow}</span>
            </p>
        </div>
    `;

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const htmlTemplate = (row) => {
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "";
        const canEdit = isOwner || isUnowned || currentAdminEmail === SUPER_ADMIN_EMAIL;

        let actionBtns = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black">فتح</a>`;

        if (canEdit) {
            if (row.status === 'pending') {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">حجز للمراجعة</button>`;
            } else if (row.status === 'reviewing' && isOwner) {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black">تم النشر ✨</button>`;
                actionBtns += `<button onclick="releaseLock(${row.id})" class="text-slate-400 border border-slate-700 px-3 py-2 rounded-xl text-[9px]">إلغاء الحجز</button>`;
            } else if (row.status === 'approved') {
                actionBtns += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب</button>`;
            }
        } else {
            actionBtns += `<span class="text-[9px] text-red-400 italic">🔒 محجوز لـ ${row.processed_by}</span>`;
        }

        return { actionBtns, canEdit };
    };

    // رندر اللابتوب
    desktopBody.innerHTML = filtered.map(row => {
        const { actionBtns, canEdit } = htmlTemplate(row);
        return `
        <tr class="archive-item ${!canEdit ? 'opacity-40' : ''}">
            <td class="p-4 rounded-r-2xl border-y border-r border-slate-800">
                <div class="font-black text-xs text-white">${row.subject}</div>
                <div class="text-[9px] text-amber-500 mt-1 italic">📌 ${row.description || 'بدون وصف'}</div>
            </td>
            <td class="p-4 border-y border-slate-800">
                <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full h-10 p-2 text-[11px]" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-4 border-y border-slate-800 text-center text-[10px]">${row.processed_by || '--'}</td>
            <td class="p-4 rounded-l-2xl border-y border-l border-slate-800"><div class="flex gap-2">${actionBtns}</div></td>
        </tr>`;
    }).join("");

    // رندر الجوال
    mobileContainer.innerHTML = filtered.map(row => {
        const { actionBtns, canEdit } = htmlTemplate(row);
        return `
        <div class="archive-item p-5 space-y-3 ${!canEdit ? 'opacity-50' : ''}">
            <div class="flex justify-between text-[10px] font-bold"><span class="text-white">${row.subject}</span><span class="text-blue-400">${row.processed_by || 'متاح'}</span></div>
            <div class="text-[10px] text-amber-500 bg-amber-500/5 p-2 rounded-xl italic">📝 ${row.description || 'بدون وصف'}</div>
            <textarea ${!canEdit ? 'disabled' : ''} onchange="updateNote(${row.id}, this.value)" class="w-full p-3 text-[11px] h-20" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap">${actionBtns}</div>
        </div>`;
    }).join("");
}

// الدوال المساعدة
window.updateStatus = async (id, newStatus) => {
    await supa.from("resources").update({ status: newStatus, processed_by: currentAdminName, updated_at: new Date() }).eq("id", id);
    loadAllRows();
};

window.updateNote = async (id, note) => {
    await supa.from("resources").update({ admin_note: note, processed_by: currentAdminName }).eq("id", id);
};

window.releaseLock = async (id) => {
    await supa.from("resources").update({ processed_by: null, status: 'pending' }).eq("id", id);
    loadAllRows();
};

// الفلاتر
document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.onclick = () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
        btn.classList.add("bg-blue-600", "text-white");
        renderLists();
    };
});

// بدء التشغيل
refreshUI();
