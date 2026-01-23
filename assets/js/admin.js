const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";
let currentAdminName = ""; 

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    // جلب الاسم من جدول المشرفين
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
    
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    // حساب الإنتاجية اليومية
    const today = new Date().toLocaleDateString();
    const myDoneToday = allRows.filter(r => r.processed_by === currentAdminName && new Date(r.updated_at).toLocaleDateString() === today).length;
    const totalRemaining = allRows.filter(r => r.status === 'pending').length;

    document.getElementById("productivityStats").innerHTML = `يا هلا ${currentAdminName}، أنجزت <b class="text-white mx-1">${myDoneToday}</b> ملفات اليوم. المتبقي بانتظار فرزك: <b class="text-white mx-1">${totalRemaining}</b>`;
    document.getElementById("pendingCount").textContent = totalRemaining;
    document.getElementById("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    const rowHTML = (row) => `
        <tr class="archive-item">
            <td class="p-3 rounded-r-xl border-y border-r border-slate-800">
                <input type="text" onchange="updateData(${row.id}, {subject: this.value})" class="bg-transparent border-none text-xs font-bold w-full" value="${row.subject}">
            </td>
            <td class="p-3 border-y border-slate-800">
                <textarea onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full h-8 p-1 text-[11px] bg-black/20" placeholder="اكتب ملاحظة علمية...">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-3 border-y border-slate-800 text-center text-[10px] font-bold text-blue-400/60">${row.processed_by || '--'}</td>
            <td class="p-3 rounded-l-xl border-y border-l border-slate-800 text-center">
                <div class="flex gap-3 justify-center text-[11px] font-bold">
                    <a href="${row.file_url}" target="_blank" class="text-blue-400">فتح</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" class="${row.status === 'approved' ? 'text-amber-500' : 'text-emerald-500'}">
                        ${row.status === 'approved' ? 'تعليق' : 'نشر'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="text-slate-600 hover:text-red-500">✕</button>
                </div>
            </td>
        </tr>`;

    const cardHTML = (row) => `
        <div class="archive-item p-4 rounded-xl space-y-3">
            <div class="flex justify-between items-center"><div class="font-bold text-xs">${row.subject}</div><div class="text-[9px] text-blue-400/50">${row.processed_by || 'جديد'}</div></div>
            <textarea onchange="updateData(${row.id}, {admin_note: this.value})" class="w-full p-2 text-[11px] h-12" placeholder="الملاحظة العلمية...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 text-[10px] font-bold">
                <a href="${row.file_url}" target="_blank" class="flex-1 bg-slate-800 py-2 rounded-lg text-center">فتح الملف</a>
                <button onclick="toggleStatus(${row.id}, '${row.status}')" class="flex-[2] py-2 rounded-lg ${row.status === 'approved' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}">
                    ${row.status === 'approved' ? 'سحب النشر' : 'اعتماد ونشر'}
                </button>
            </div>
        </div>`;

    desktopBody.innerHTML = filtered.map(rowHTML).join("");
    mobileContainer.innerHTML = filtered.map(cardHTML).join("");
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
