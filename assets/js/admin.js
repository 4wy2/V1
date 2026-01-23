const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; // ضع إيميلك هنا

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
    await supa.auth.signOut();
    location.reload(); // إعادة تحميل الصفحة للعودة لشاشة الدخول
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

    const generateHTML = (row, type) => {
        const isSuperAdmin = currentAdminEmail === SUPER_ADMIN_EMAIL;
        const isOwner = row.processed_by === currentAdminName;
        const isUnowned = !row.processed_by || row.processed_by === "" || row.processed_by === "--";
        const canEdit = isOwner || isUnowned || isSuperAdmin;

        const actionButtons = `
            <div class="flex gap-2 justify-center text-[10px] font-black">
                <a href="${row.file_url}" target="_blank" class="text-blue-400 p-1">فتح</a>
                ${canEdit ? `
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" class="${row.status === 'approved' ? 'text-amber-500' : 'text-emerald-500'} p-1">
                        ${row.status === 'approved' ? 'تعليق' : 'نشر ✅'}
                    </button>
                    ${!isUnowned ? `<button onclick="releaseLock(${row.id})" class="text-white bg-slate-700 px-2 py-0.5 rounded text-[9px]">فك القفل 🔓</button>` : ''}
                ` : `<span class="text-red-500">🔒 مقفل</span>`}
                ${isSuperAdmin || isOwner ? `<button onclick="deleteRow(${row.id})" class="text-slate-500 hover:text-red-500 p-1">✕</button>` : ''}
            </div>
        `;

        if (type === 'desktop') {
            return `
            <tr class="archive-item ${!canEdit ? 'opacity-40 grayscale-[0.5]' : ''}">
                <td class="p-3 rounded-r-2xl border-y border-r border-slate-800">
                    <input type="text" ${!canEdit ? 'disabled' : ''} onchange="updateData(${row.id}, {subject: this.value})" class="bg-transparent border-none text-xs font-black w-full" value="${row.subject}">
                    <div class="text-[9px] text-amber-500 italic mt-1">📌 وصف الطالب: ${row.description || 'بدون وصف'}</div>
                </td>
                <td class="p-3 border-y border-slate-800">
                    <textarea ${!canEdit ? 'disabled' : ''} onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full h-10 p-2 text-[11px] bg-black/20" placeholder="${!canEdit ? 'بانتظار الإذن من ' + row.processed_by : 'ملاحظة اللجنة...'}">${row.admin_note || ''}</textarea>
                </td>
                <td class="p-3 border-y border-slate-800 text-center text-[10px] font-bold text-blue-400/60">${row.processed_by || '--'}</td>
                <td class="p-3 rounded-l-2xl border-y border-l border-slate-800">${actionButtons}</td>
            </tr>`;
        } else {
            return `
            <div class="archive-item p-4 rounded-3xl ${!canEdit ? 'opacity-50 grayscale' : ''}">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-black text-xs">${row.subject}</div>
                    <div class="text-[9px] font-bold text-blue-400/50">${row.processed_by || 'متاح'}</div>
                </div>
                <div class="text-[10px] text-amber-500 bg-amber-500/5 p-2 rounded-lg mb-2 italic">📝 ${row.description || 'لا يوجد وصف.'}</div>
                <textarea ${!canEdit ? 'disabled' : ''} onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full p-2 text-[11px] h-14 mb-2" placeholder="ملاحظة المشرف...">${row.admin_note || ''}</textarea>
                ${actionButtons}
            </div>`;
        }
    };

    desktopBody.innerHTML = filtered.map(r => generateHTML(r, 'desktop')).join("");
    mobileContainer.innerHTML = filtered.map(r => generateHTML(r, 'mobile')).join("");
}

// دالة فك القفل (تصفير الملكية)
window.releaseLock = async (id) => {
    if (!confirm("هل تريد فك القفل عن هذا الملف لإتاحته لمشرفين آخرين؟")) return;
    await supa.from("resources").update({ processed_by: null }).eq("id", id);
    loadAllRows();
};

async function updateData(id, updateObj) {
    const finalUpdate = { ...updateObj, processed_by: currentAdminName };
    await supa.from("resources").update(finalUpdate).eq("id", id);
    loadAllRows(); // تحديث فوري للقائمة بعد التعديل
}

window.toggleStatus = async (id, status) => {
    const newStatus = status === 'approved' ? 'pending' : 'approved';
    let updateObj = { status: newStatus, processed_by: currentAdminName };
    
    // إذا كان يسحب النشر، نسأله إذا يبي يشيل اسمه
    if (status === 'approved') {
        if (confirm("تم سحب النشر. هل تريد فك القفل عن الملف أيضاً؟")) {
            updateObj.processed_by = null;
        }
    }
    
    await supa.from("resources").update(updateObj).eq("id", id);
    loadAllRows();
};

window.deleteRow = async (id) => { if(confirm("حذف؟")) { await supa.from("resources").delete().eq("id", id); loadAllRows(); } };

document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supa.auth.signInWithPassword({ email: document.getElementById("email").value, password: document.getElementById("password").value });
    if (error) alert("خطأ في الدخول: " + error.message);
    refreshUI();
};
document.getElementById("searchBox").oninput = renderLists;
document.querySelectorAll(".filterBtn").forEach(btn => btn.onclick = () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("bg-blue-600", "text-white"));
    btn.classList.add("bg-blue-600", "text-white");
    renderLists();
});
refreshUI();
