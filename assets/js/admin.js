const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- إعدادات الصلاحيات ---
const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; // ضع إيميلك هنا لتتمكن من تعديل كل شيء

let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 
let currentAdminEmail = "";

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    currentAdminEmail = session.user.email;
    const { data: adminData } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
    currentAdminName = adminData?.full_name || currentAdminEmail.split('@')[0];

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
    
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && new Date(r.updated_at).toLocaleDateString() === today).length;
    
    document.getElementById("productivityStats").innerHTML = `يا هلا ${currentAdminName}، أنجزت <b class="text-white mx-1">${myDoneToday}</b> ملفات اليوم. استمر!`;
    document.getElementById("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    const generateHTML = (row, type) => {
        // شرط القفل: إذا كان هناك مشرف آخر عالج الملف وأنت لست "المشرف الأعلى"
        const isLocked = row.processed_by && row.processed_by !== currentAdminName && currentAdminEmail !== SUPER_ADMIN_EMAIL;

        if (type === 'desktop') {
            return `
            <tr class="archive-item ${isLocked ? 'locked-row' : ''}">
                <td class="p-3 rounded-r-2xl border-y border-r border-slate-800">
                    <input type="text" ${isLocked ? 'disabled' : ''} onchange="updateData(${row.id}, {subject: this.value})" class="bg-transparent border-none text-xs font-black w-full mb-1" value="${row.subject}">
                    <div class="bg-amber-500/5 p-2 rounded-lg text-[10px] text-amber-500 italic border-r-2 border-amber-500/30">
                        📌 نوتة الطالب: ${row.description || 'بدون وصف'}
                    </div>
                </td>
                <td class="p-3 border-y border-slate-800">
                    <textarea ${isLocked ? 'disabled' : ''} onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full h-12 p-2 text-[11px] bg-black/20" placeholder="${isLocked ? 'مقفل بواسطة ' + row.processed_by : 'اكتب ملاحظة المشرف...'}">${row.admin_note || ''}</textarea>
                </td>
                <td class="p-3 border-y border-slate-800 text-center text-[10px] font-bold ${isLocked ? 'text-red-400' : 'text-blue-400/40'}">
                    ${row.processed_by || '--'}
                </td>
                <td class="p-3 rounded-l-2xl border-y border-l border-slate-800 text-center">
                    <div class="flex gap-3 justify-center text-[10px] font-black">
                        <a href="${row.file_url}" target="_blank" class="text-blue-400">فتح</a>
                        ${!isLocked ? `
                            <button onclick="toggleStatus(${row.id}, '${row.status}')" class="${row.status === 'approved' ? 'text-amber-500' : 'text-emerald-500'}">
                                ${row.status === 'approved' ? 'تعليق' : 'نشر'}
                            </button>
                        ` : '<span class="text-slate-600">🔒</span>'}
                    </div>
                </td>
            </tr>`;
        } else {
            return `
            <div class="archive-item p-4 rounded-[2rem] space-y-4 ${isLocked ? 'locked-row' : ''}">
                <div class="flex justify-between items-center"><div class="font-black text-xs">${row.subject}</div><div class="text-[9px] font-bold text-blue-500/50">${row.processed_by || 'جديد'}</div></div>
                <div class="bg-amber-500/5 p-3 rounded-2xl text-[10px] text-amber-500 leading-relaxed">
                    <b>وصف الطالب:</b> ${row.description || 'لا يوجد وصف.'}
                </div>
                <textarea ${isLocked ? 'disabled' : ''} onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full p-3 text-[11px] h-16" placeholder="${isLocked ? 'مقفل بواسطة ' + row.processed_by : 'ملاحظة اللجنة العلمية...'}">${row.admin_note || ''}</textarea>
                <div class="flex gap-2 font-black text-[10px]">
                    <a href="${row.file_url}" target="_blank" class="flex-1 bg-slate-800 py-3 rounded-xl text-center">فتح الملف</a>
                    ${!isLocked ? `
                        <button onclick="toggleStatus(${row.id}, '${row.status}')" class="flex-[2] py-3 rounded-xl ${row.status === 'approved' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}">
                            ${row.status === 'approved' ? 'سحب النشر' : 'نشر للطلاب'}
                        </button>
                    ` : '<div class="flex-1 py-3 text-center text-red-500/50 bg-red-500/5 rounded-xl">🔒 الملف مقفل</div>'}
                </div>
            </div>`;
        }
    };

    desktopBody.innerHTML = filtered.map(r => generateHTML(r, 'desktop')).join("");
    mobileContainer.innerHTML = filtered.map(r => generateHTML(r, 'mobile')).join("");
}

async function updateData(id, updateObj) {
    const finalUpdate = { ...updateObj, processed_by: currentAdminName };
    allRows = allRows.map(r => r.id === id ? { ...r, ...finalUpdate, updated_at: new Date().toISOString() } : r);
    renderLists();
    await supa.from("resources").update(finalUpdate).eq("id", id);
}

window.toggleStatus = (id, status) => updateData(id, { status: status === 'approved' ? 'pending' : 'approved' });
window.deleteRow = async (id) => { if(confirm("حذف؟")) { await supa.from("resources").delete().eq("id", id); loadAllRows(); } };

document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    await supa.auth.signInWithPassword({ email: document.getElementById("email").value, password: document.getElementById("password").value });
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
