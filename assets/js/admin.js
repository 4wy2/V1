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
        <div class="glass-card p-6 flex flex-col justify-between border-r-4 ${row.status === 'approved' ? 'border-emerald-500' : 'border-amber-500'}">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <h3 class="font-black text-lg">${row.subject}</h3>
                    <span class="text-[10px] bg-white/10 px-2 py-1 rounded italic text-gray-400">${row.processed_by || 'غير مفروز'}</span>
                </div>
                
                <textarea onchange="updateNote(${row.id}, this.value)" 
                    class="w-full p-3 rounded-xl text-xs h-20 mb-4" 
                    placeholder="ملاحظات اللجنة العلمية...">${row.admin_note || ''}</textarea>
            </div>
            
            <div class="flex gap-2">
                <a href="${row.file_url}" target="_blank" class="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-center text-xs font-bold">معاينة</a>
                <button onclick="toggleStatus(${row.id}, '${row.status}')" 
                    class="flex-[2] btn-confirm py-3 rounded-xl text-xs font-black shadow-lg">
                    ${row.status === 'approved' ? 'تعليق ⏸️' : 'اعتماد ✅'}
                </button>
            </div>
        </div>
    `).join("");
}

window.toggleStatus = async (id, status) => {
    const { data: { session } } = await supa.auth.getSession();
    const newStatus = status === 'approved' ? 'pending' : 'approved';
    await supa.from("resources").update({ status: newStatus, processed_by: session.user.email }).eq("id", id);
    loadAllRows();
};

window.updateNote = async (id, note) => {
    const { data: { session } } = await supa.auth.getSession();
    await supa.from("resources").update({ admin_note: note, processed_by: session.user.email }).eq("id", id);
};

// الأحداث الأساسية
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    await supa.auth.signInWithPassword({ email: document.getElementById("email").value, password: document.getElementById("password").value });
    refreshUI();
};
document.getElementById("searchBox").oninput = renderList;
document.querySelectorAll(".filterBtn").forEach(btn => btn.onclick = () => { currentFilter = btn.dataset.filter; renderList(); });
refreshUI();
