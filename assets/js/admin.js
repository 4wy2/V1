console.log("ADMIN.JS LOADED ✅");

const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

if (!window.supabase) {
    alert("Supabase JS لم يتم تحميله. تأكد من رابط CDN.");
}

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "ee_admin_auth_v1",
    },
});

let currentFilter = "pending";
let allRows = [];

// ---------------- UI helpers ----------------
function qs(id) { return document.getElementById(id); }
function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (s) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[s]));
}

function setLoginMsg(text) {
    const msg = qs("loginMsg");
    if (!msg) return;
    if (!text) { hide(msg); msg.textContent = ""; return; }
    msg.textContent = text;
    show(msg);
}

function setPanelMsg(text) {
    const msg = qs("panelMsg");
    if (!msg) return;
    if (!text) { hide(msg); msg.textContent = ""; return; }
    msg.textContent = text;
    show(msg);
}

function setDebug(html) {
    const box = qs("debugBox");
    if (box) box.innerHTML = html || "";
}

function setLoading(text) {
    const listBox = qs("listBox");
    if (listBox) listBox.innerHTML = `<div class="text-center text-sm text-white/40 py-8">${escapeHtml(text)}</div>`;
}

// ---------------- Auth helpers ----------------
async function getCurrentUserSafe() {
    const { data: sess } = await supa.auth.getSession();
    if (sess?.session?.user) return sess.session.user;
    const { data: usr } = await supa.auth.getUser();
    return usr?.user || null;
}

async function checkIsAdmin(user) {
    const { data, error } = await supa
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("[admins select error]", error);
        return { ok: false, reason: `خطأ في قاعدة البيانات: ${error.message}` };
    }
    if (!data) return { ok: false, reason: "ليس لديك صلاحيات أدمن" };
    return { ok: true, reason: "" };
}

async function refreshUI() {
    const loginCard = qs("loginCard");
    const adminPanel = qs("adminPanel");
    const logoutBtn = qs("logoutBtn");
    const whoami = qs("whoami");

    const user = await getCurrentUserSafe();

    setDebug(user
        ? `Session: <b>${escapeHtml(user.email || "")}</b><br>UID: <code>${escapeHtml(user.id)}</code>`
        : `لا توجد جلسة نشطة`
    );

    if (!user) {
        show(loginCard); hide(adminPanel); hide(logoutBtn);
        setLoginMsg("");
        return;
    }

    const adminCheck = await checkIsAdmin(user);
    if (!adminCheck.ok) {
        show(loginCard); hide(adminPanel); hide(logoutBtn);
        setLoginMsg(adminCheck.reason);
        return;
    }

    hide(loginCard); show(adminPanel); show(logoutBtn);
    if (whoami) whoami.textContent = `مرحباً: ${user.email}`;

    await loadAllRows();
}

// ---------------- DB ops ----------------
async function loadAllRows() {
    setLoading("جاري تحميل البيانات...");
    const { data, error } = await supa
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        setPanelMsg("فشل التحميل: " + error.message);
        return;
    }
    allRows = data || [];
    renderList();
}

async function updateStatus(id, status) {
    const { error } = await supa.from("resources").update({ status }).eq("id", id);
    if (error) { alert("خطأ في التحديث: " + error.message); return false; }
    return true;
}

async function deleteRow(id) {
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (error) { alert("خطأ في الحذف: " + error.message); return false; }
    return true;
}

// ---------------- UI Rendering ----------------
function renderList() {
    const listBox = qs("listBox");
    const emptyBox = qs("emptyBox");
    const countBadge = qs("countBadge");
    const searchVal = (qs("searchBox")?.value || "").toLowerCase();

    let rows = allRows.filter(r => {
        const matchesFilter = currentFilter === "all" || r.status === currentFilter;
        const matchesSearch = r.subject?.toLowerCase().includes(searchVal);
        return matchesFilter && matchesSearch;
    });

    if (countBadge) countBadge.textContent = rows.length;

    if (rows.length === 0) {
        listBox.innerHTML = "";
        show(emptyBox);
    } else {
        hide(emptyBox);
        listBox.innerHTML = rows.map(row => `
            <div class="btn-ghost rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="text-right">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-black text-sm text-white/90">${escapeHtml(row.subject)}</span>
                        <span class="text-[10px] px-2 py-1 rounded-full ${row.status === 'approved' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}">${row.status}</span>
                    </div>
                    <div class="text-[10px] text-white/25">${new Date(row.created_at).toLocaleString("ar-SA")}</div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="${row.file_url}" target="_blank" class="btn-ghost px-3 py-1.5 rounded-xl text-xs">عرض</a>
                    <button data-action="approve" data-id="${row.id}" class="btn-brand px-3 py-1.5 rounded-xl text-xs ${row.status === 'approved' ? 'hidden' : ''}">اعتماد</button>
                    <button data-action="pending" data-id="${row.id}" class="btn-ghost px-3 py-1.5 rounded-xl text-xs ${row.status === 'pending' ? 'hidden' : ''}">تعليق</button>
                    <button data-action="delete" data-id="${row.id}" class="btn-ghost px-3 py-1.5 rounded-xl text-xs border-red-500/50 text-red-400">حذف</button>
                </div>
            </div>
        `).join("");
    }
}

// ---------------- Setup ----------------
document.addEventListener("DOMContentLoaded", async () => {
    
    qs("loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = qs("email").value;
        const password = qs("password").value;
        setLoginMsg("جاري الدخول...");
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) setLoginMsg(error.message);
        else await refreshUI();
    });

    qs("logoutBtn")?.addEventListener("click", async () => {
        await supa.auth.signOut();
        await refreshUI();
    });

    qs("listBox")?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === "approve") if (await updateStatus(id, "approved")) await loadAllRows();
        if (action === "pending") if (await updateStatus(id, "pending")) await loadAllRows();
        if (action === "delete") if (confirm("حذف؟")) if (await deleteRow(id)) await loadAllRows();
    });

    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    qs("searchBox")?.addEventListener("input", renderList);
    qs("refreshBtn")?.addEventListener("click", refreshUI);
    qs("refreshBtn2")?.addEventListener("click", refreshUI);

    // التحقق الأولي
    await refreshUI();
});
