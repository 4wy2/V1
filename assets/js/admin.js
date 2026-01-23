const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

// تهيئة Supabase بإعدادات متوافقة مع المتصفح
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

let allRows = [];
let currentFilter = "pending";

// Helper Functions
const qs = (id) => document.getElementById(id);
const hide = (el) => el && el.classList.add("hidden");
const show = (el) => el && el.classList.remove("hidden");

async function refreshUI() {
    const { data: { session } } = await supa.auth.getSession();
    const user = session?.user;

    if (!user) {
        show(qs("loginCard"));
        hide(qs("adminPanel"));
        return;
    }

    // التحقق من صلاحية الأدمن
    const { data: adminData, error } = await supa
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error || !adminData) {
        alert("عذراً، هذا الحساب ليس لديه صلاحيات المسؤول.");
        await supa.auth.signOut();
        location.reload();
        return;
    }

    hide(qs("loginCard"));
    show(qs("adminPanel"));
    qs("whoami").textContent = `المسؤول: ${user.email}`;
    loadAllRows();
}

async function loadAllRows() {
    const listBox = qs("listBox");
    listBox.innerHTML = '<div class="text-center py-8 opacity-50">جاري التحميل...</div>';

    const { data, error } = await supa
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        listBox.innerHTML = `<div class="text-red-400">خطأ: ${error.message}</div>`;
        return;
    }

    allRows = data;
    renderList();
}

function renderList() {
    const search = (qs("searchBox")?.value || "").toLowerCase();
    const filtered = allRows.filter(r => {
        const matchesFilter = currentFilter === "all" || r.status === currentFilter;
        const matchesSearch = r.subject.toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
    });

    qs("countBadge").textContent = filtered.length;
    
    if (filtered.length === 0) {
        qs("listBox").innerHTML = '<div class="text-center py-10 opacity-40">لا توجد نتائج</div>';
        return;
    }

    qs("listBox").innerHTML = filtered.map(row => `
        <div class="glass rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-3">
            <div class="text-right">
                <div class="flex items-center gap-2">
                    <span class="font-bold">${row.subject}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full ${row.status === 'approved' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}">${row.status}</span>
                </div>
                <div class="text-xs opacity-50 mt-1">${row.note || 'بدون ملاحظات'}</div>
            </div>
            <div class="flex gap-2">
                <a href="${row.file_url}" target="_blank" class="btn-ghost px-3 py-1.5 rounded-lg text-xs">عرض</a>
                <button onclick="updateStatus(${row.id}, '${row.status === 'approved' ? 'pending' : 'approved'}')" class="btn-brand px-3 py-1.5 rounded-lg text-xs">
                    ${row.status === 'approved' ? 'تعليق' : 'اعتماد'}
                </button>
                <button onclick="deleteRow(${row.id})" class="text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs">حذف</button>
            </div>
        </div>
    `).join("");
}

// Global functions for buttons
window.updateStatus = async (id, status) => {
    await supa.from("resources").update({ status }).eq("id", id);
    loadAllRows();
};

window.deleteRow = async (id) => {
    if (confirm("هل أنت متأكد؟")) {
        await supa.from("resources").delete().eq("id", id);
        loadAllRows();
    }
};

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    refreshUI();

    qs("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = qs("email").value;
        const password = qs("password").value;
        
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) alert("فشل تسجيل الدخول: " + error.message);
        else refreshUI();
    });

    qs("logoutBtn").addEventListener("click", async () => {
        await supa.auth.signOut();
        location.reload();
    });

    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            renderList();
        };
    });

    qs("searchBox").oninput = renderList;
});
