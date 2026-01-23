console.log("ADMIN.JS LOADED ✅");

const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

// التأكد من وجود المكتبة
if (typeof supabase === 'undefined') {
    alert("خطأ: مكتبة Supabase لم يتم تحميلها بشكل صحيح!");
}

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentFilter = "pending";
let allRows = [];

// --- أدوات مساعدة ---
const qs = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

function setLoginMsg(text) {
    const msg = qs("loginMsg");
    if (msg) { msg.textContent = text; text ? show(msg) : hide(msg); }
}

// --- وظائف التحقق والتشغيل ---
async function refreshUI() {
    console.log("Refreshing UI...");
    const { data: { user } } = await supa.auth.getUser();

    if (!user) {
        show(qs("loginCard"));
        hide(qs("adminPanel"));
        return;
    }

    // التحقق من جدول الأدمن
    const { data: adminData, error } = await supa
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error || !adminData) {
        setLoginMsg("عذراً، هذا الحساب ليس أدمن.");
        show(qs("loginCard"));
        hide(qs("adminPanel"));
        return;
    }

    hide(qs("loginCard"));
    show(qs("adminPanel"));
    qs("whoami").textContent = `الأدمن: ${user.email}`;
    await loadAllRows();
}

async function loadAllRows() {
    const listBox = qs("listBox");
    listBox.innerHTML = `<div class="text-center py-10 opacity-40">جاري التحقق من البيانات...</div>`;

    const { data, error } = await supa
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    allRows = data || [];
    renderList();
}

function renderList() {
    const listBox = qs("listBox");
    const countBadge = qs("countBadge");
    const search = (qs("searchBox")?.value || "").toLowerCase();

    const filtered = allRows.filter(r => {
        const matchesFilter = currentFilter === "all" || r.status === currentFilter;
        const matchesSearch = r.subject?.toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        listBox.innerHTML = `<div class="text-center py-10 opacity-30">لا توجد سجلات</div>`;
        return;
    }

    listBox.innerHTML = filtered.map(row => `
        <div class="glass p-5 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 border border-white/5">
            <div class="text-right w-full">
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${row.status}</span>
                    <h3 class="font-bold text-lg">${row.subject}</h3>
                </div>
                <p class="text-sm text-white/40">${row.note || 'بدون ملاحظات'}</p>
            </div>
            <div class="flex gap-2 shrink-0">
                <a href="${row.file_url}" target="_blank" class="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold">فتح</a>
                ${row.status !== 'approved' ? `<button onclick="handleAction(${row.id}, 'approved')" class="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">اعتماد</button>` : ''}
                ${row.status !== 'pending' ? `<button onclick="handleAction(${row.id}, 'pending')" class="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs font-bold">تعليق</button>` : ''}
                <button onclick="handleDelete(${row.id})" class="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold">حذف</button>
            </div>
        </div>
    `).join("");
}

// --- معالجة العمليات ---
window.handleAction = async (id, status) => {
    const { error } = await supa.from("resources").update({ status }).eq("id", id);
    if (error) alert("خطأ: " + error.message);
    else await loadAllRows();
};

window.handleDelete = async (id) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (error) alert("خطأ: " + error.message);
    else await loadAllRows();
};

window.setFilter = (f) => {
    currentFilter = f;
    renderList();
};

// --- تشغيل النظام عند التحميل ---
document.addEventListener("DOMContentLoaded", () => {
    qs("loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        setLoginMsg("جاري الدخول...");
        const email = qs("email").value.trim();
        const password = qs("password").value;
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) {
            alert("خطأ: " + error.message);
            setLoginMsg("فشل الدخول.");
        } else {
            await refreshUI();
        }
    });

    qs("logoutBtn")?.addEventListener("click", async () => {
        await supa.auth.signOut();
        location.reload();
    });

    qs("searchBox")?.addEventListener("input", renderList);
    
    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            renderList();
        };
    });

    refreshUI();
});
