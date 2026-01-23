console.log("ADMIN.JS LOADED ✅");

// إعدادات Supabase
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

// التحقق من تحميل المكتبة
if (typeof supabase === 'undefined') {
    alert("خطأ: مكتبة Supabase لم يتم تحميلها بشكل صحيح!");
}

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "ee_admin_session"
    },
});

let currentFilter = "pending";
let allRows = [];

// --- دوائر مساعدة ---
const qs = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

function setLoginMsg(text) {
    const msg = qs("loginMsg");
    if (msg) { msg.textContent = text; text ? show(msg) : hide(msg); }
}

// --- الوظائف الأساسية ---
async function checkIsAdmin(user) {
    try {
        const { data, error } = await supa
            .from("admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (e) {
        console.error("Admin check failed:", e);
        return false;
    }
}

async function refreshUI() {
    const user = (await supa.auth.getUser()).data.user;

    if (!user) {
        show(qs("loginCard"));
        hide(qs("adminPanel"));
        return;
    }

    const isAdmin = await checkIsAdmin(user);
    if (!isAdmin) {
        alert("حسابك مسجل دخول، لكنه ليس مسجلاً في جدول admins.");
        setLoginMsg("خطأ: ليس لديك صلاحية الوصول للوحة الإدارة.");
        show(qs("loginCard"));
        hide(qs("adminPanel"));
        return;
    }

    // إذا كان أدمن
    hide(qs("loginCard"));
    show(qs("adminPanel"));
    qs("whoami").textContent = `مرحباً: ${user.email}`;
    await loadData();
}

async function loadData() {
    const listBox = qs("listBox");
    listBox.innerHTML = `<div class="text-center py-10 opacity-50">جاري جلب البيانات...</div>`;

    const { data, error } = await supa
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        alert("فشل جلب البيانات: " + error.message);
        return;
    }

    allRows = data || [];
    renderList();
}

function renderList() {
    const listBox = qs("listBox");
    const countBadge = qs("countBadge");
    const search = qs("searchBox").value.toLowerCase();

    const filtered = allRows.filter(r => {
        const matchesFilter = currentFilter === "all" || r.status === currentFilter;
        const matchesSearch = r.subject?.toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        listBox.innerHTML = `<div class="text-center py-10 opacity-40">لا توجد سجلات</div>`;
        return;
    }

    listBox.innerHTML = filtered.map(row => `
        <div class="glass p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="text-right">
                <div class="font-bold">${row.subject}</div>
                <div class="text-[11px] opacity-50">${new Date(row.created_at).toLocaleString("ar-SA")}</div>
                <div class="mt-1"><span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 border border-white/20">${row.status}</span></div>
            </div>
            <div class="flex gap-2">
                <a href="${row.file_url}" target="_blank" class="btn-ghost px-3 py-1 rounded-lg text-xs">فتح</a>
                ${row.status !== 'approved' ? `<button onclick="updateRowStatus(${row.id}, 'approved')" class="btn-brand px-3 py-1 rounded-lg text-xs">اعتماد</button>` : ''}
                ${row.status !== 'pending' ? `<button onclick="updateRowStatus(${row.id}, 'pending')" class="btn-ghost px-3 py-1 rounded-lg text-xs">تعليق</button>` : ''}
                <button onclick="deleteRow(${row.id})" class="btn-ghost px-3 py-1 rounded-lg text-xs border-red-500/50 text-red-300">حذف</button>
            </div>
        </div>
    `).join("");
}

// --- العمليات الخارجية ---
window.updateRowStatus = async (id, status) => {
    const { error } = await supa.from("resources").update({ status }).eq("id", id);
    if (error) alert(error.message);
    else await loadData();
};

window.deleteRow = async (id) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadData();
};

// --- مستمعي الأحداث ---
document.addEventListener("DOMContentLoaded", () => {
    qs("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        setLoginMsg("جاري الدخول...");
        
        const email = qs("email").value.trim();
        const password = qs("password").value;

        const { error } = await supa.auth.signInWithPassword({ email, password });

        if (error) {
            alert("فشل الدخول: " + error.message);
            setLoginMsg("خطأ: " + error.message);
        } else {
            setLoginMsg("");
            await refreshUI();
        }
    });

    qs("logoutBtn").addEventListener("click", async () => {
        await supa.auth.signOut();
        location.reload();
    });

    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    qs("searchBox").addEventListener("input", renderList);
    qs("refreshBtn").addEventListener("click", refreshUI);
    qs("refreshBtn2").addEventListener("click", refreshUI);

    // التشغيل التلقائي عند فتح الصفحة
    refreshUI();
});
