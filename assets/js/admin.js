const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("logoutBtn").classList.remove("hidden");
    document.getElementById("whoami").textContent = session.user.email.split('@')[0];
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

    document.getElementById("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    // رندر اللاب توب (Table)
    desktopBody.innerHTML = filtered.map(row => `
        <tr class="archive-item">
            <td class="p-3 rounded-r-xl border-y border-r border-slate-800">
                <input type="text" onchange="updateData(${row.id}, {subject: this.value})" 
                    class="bg-transparent border-none text-xs font-bold w-full" value="${row.subject}">
            </td>
            <td class="p-3 border-y border-slate-800">
                <textarea onchange="updateData(${row.id}, {admin_note: this.value})" 
                    class="w-full h-8 min-h-[32px] p-1 text-[11px] bg-black/20" placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-3 border-y border-slate-800 text-center text-[10px] text-slate-500">${row.processed_by ? row.processed_by.split('@')[0] : '--'}</td>
            <td class="p-3 rounded-l-xl border-y border-l border-slate-800 text-center">
                <div class="flex gap-3 justify-center text-[11px] font-bold">
                    <a href="${row.file_url}" target="_blank" class="text-blue-400">فتح</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" class="${row.status === 'approved' ? 'text-amber-500' : 'text-emerald-500'}">
                        ${row.status === 'approved' ? 'تعليق' : 'اعتماد'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="text-slate-600">✕</button>
                </div>
            </td>
        </tr>
    `).join("");

    // رندر الجوال (Cards)
    mobileList.innerHTML = filtered.map(row => `
        <div class="archive-item p-4 rounded-xl space-y-3">
            <div class="flex justify-between items-start">
                <div class="font-bold text-sm">${row.subject}</div>
                <div class="text-[10px] text-slate-500">${row.processed_by ? row.processed_by.split('@')[0] : 'جديد'}</div>
            </div>
            <textarea onchange="updateData(${row.id}, {admin_note: this.value})" 
                class="w-full p-2 text-xs h-16" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2">
                <a href="${row.file_url}" target="_blank" class="flex-1 bg-slate-800 py-2 rounded-lg text-center text-xs font-bold">فتح</a>
                <button onclick="toggleStatus(${row.id}, '${row.status}')" 
                    class="flex-[2] py-2 rounded-lg text-xs font-bold ${row.status === 'approved' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}">
                    ${row.status === 'approved' ? 'تعليق' : 'اعتماد ونشر'}
                </button>
                <button onclick="deleteRow(${row.id})" class="px-3 bg-red-500/5 text-red-500 rounded-lg">✕</button>
            </div>
        </div>
    `).join("");
}

async function updateData(id, updateObj) {
    const { data: { session } } = await supa.auth.getSession();
    const finalUpdate = { ...updateObj, processed_by: session.user.email };
    allRows = allRows.map(r => r.id === id ? { ...r, ...finalUpdate } : r);
    renderLists();
    await supa.from("resources").update(finalUpdate).eq("id", id);
}

window.toggleStatus = (id, status) => {
    updateData(id, { status: status === 'approved' ? 'pending' : 'approved' });
};

window.deleteRow = async (id) => {
    if (!confirm("حذف؟")) return;
    await supa.from("resources").delete().eq("id", id);
    loadAllRows();
};

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
