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
    document.getElementById("whoami").textContent = session.user.email;
    loadAllRows();
}

async function loadAllRows() {
    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    allRows = data || [];
    renderList();
}

function renderList() {
    const container = document.getElementById("listBox");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    document.getElementById("pendingCount").textContent = allRows.filter(r => r.status === 'pending').length;
    document.getElementById("approvedCount").textContent = allRows.filter(r => r.status === 'approved').length;

    container.innerHTML = filtered.map(row => `
        <tr class="archive-row">
            <td class="px-4 py-3 td-first">
                <input type="text" onchange="updateData(${row.id}, {subject: this.value})" 
                    class="bg-transparent border-none p-0 w-full font-bold text-slate-200" value="${row.subject}">
                <div class="text-[10px] text-slate-500 mt-1">${new Date(row.created_at).toLocaleDateString()}</div>
            </td>
            <td class="px-4 py-3">
                <span class="status-badge ${row.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}">
                    ${row.status === 'approved' ? 'تم الاعتماد' : 'قيد المراجعة'}
                </span>
            </td>
            <td class="px-4 py-3">
                <textarea onchange="updateData(${row.id}, {admin_note: this.value})" 
                    class="w-full h-8 min-h-[32px] p-1 rounded border-none bg-slate-800/50 resize-y" 
                    placeholder="ملاحظة...">${row.admin_note || ''}</textarea>
            </td>
            <td class="px-4 py-3 text-center text-[11px] text-slate-400 font-mono">
                ${row.processed_by ? row.processed_by.split('@')[0] : '--'}
            </td>
            <td class="px-4 py-3 td-last text-center">
                <div class="flex gap-2 justify-center">
                    <a href="${row.file_url}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs font-bold">معاينة</a>
                    <button onclick="toggleStatus(${row.id}, '${row.status}')" class="text-xs font-bold ${row.status === 'approved' ? 'text-amber-500' : 'text-emerald-500'}">
                        ${row.status === 'approved' ? 'تعليق' : 'اعتماد'}
                    </button>
                    <button onclick="deleteRow(${row.id})" class="text-slate-600 hover:text-red-500">✕</button>
                </div>
            </td>
        </tr>
    `).join("");
}

// دالة تحديث عامة لتجنب التكرار
async function updateData(id, updateObj) {
    const { data: { session } } = await supa.auth.getSession();
    const finalUpdate = { ...updateObj, processed_by: session.user.email };
    
    // تحديث محلي سريع
    allRows = allRows.map(r => r.id === id ? { ...r, ...finalUpdate } : r);
    renderList();

    await supa.from("resources").update(finalUpdate).eq("id", id);
}

window.toggleStatus = (id, status) => {
    const newStatus = status === 'approved' ? 'pending' : 'approved';
    updateData(id, { status: newStatus });
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
document.getElementById("searchBox").oninput = renderList;
document.querySelectorAll(".filterBtn").forEach(btn => btn.onclick = () => { currentFilter = btn.dataset.filter; renderList(); });
refreshUI();
