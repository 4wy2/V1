// ===============================
// Supabase Config
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentFilter = "pending";
let allRows = [];

// ===============================
// Helpers
// ===============================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[s]));
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setMsg(text) {
  const msg = document.getElementById("loginMsg");
  if (!msg) return;
  if (!text) { hide(msg); msg.textContent = ""; return; }
  msg.textContent = text;
  show(msg);
}

function rowCard(row) {
  const subject = escapeHtml(row.subject || "");
  const note = row.note ? escapeHtml(row.note) : "";
  const status = escapeHtml(row.status || "");
  const url = row.file_url || "#";
  const created = row.created_at ? new Date(row.created_at).toLocaleString("ar-SA") : "";

  const badge =
    status === "approved"
      ? `<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 font-bold">approved</span>`
      : `<span class="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 font-bold">pending</span>`;

  const approveBtn =
    status !== "approved"
      ? `<button data-action="approve" data-id="${row.id}" class="btn-brand px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap">اعتماد</button>`
      : "";

  const rejectBtn =
    status !== "pending"
      ? `<button data-action="pending" data-id="${row.id}" class="btn-ghost px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap">إرجاع Pending</button>`
      : "";

  const delBtn =
    `<button data-action="delete" data-id="${row.id}" class="btn-ghost px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap border border-red-500/30 text-red-200/90 hover:bg-red-500/10">حذف</button>`;

  return `
    <div class="btn-ghost rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="text-right">
        <div class="flex items-center gap-2 mb-1">
          <div class="font-black text-sm text-white/90">${subject}</div>
          ${badge}
        </div>
        ${note ? `<div class="text-[11px] text-white/40">${note}</div>` : ""}
        <div class="text-[10px] text-white/25 mt-1">${created}</div>
      </div>

      <div class="flex flex-wrap gap-2 justify-start sm:justify-end">
        <a href="${url}" target="_blank" rel="noopener noreferrer"
          class="btn-ghost px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap">
          فتح الملف
        </a>
        ${approveBtn}
        ${rejectBtn}
        ${delBtn}
      </div>
    </div>
  `;
}

function renderList() {
  const listBox = document.getElementById("listBox");
  const emptyBox = document.getElementById("emptyBox");
  const countBadge = document.getElementById("countBadge");
  const q = (document.getElementById("searchBox")?.value || "").trim().toLowerCase();

  if (!listBox || !emptyBox || !countBadge) return;

  let rows = allRows;

  if (currentFilter !== "all") {
    rows = rows.filter(r => r.status === currentFilter);
  }
  if (q) {
    rows = rows.filter(r => (r.subject || "").toLowerCase().includes(q));
  }

  countBadge.textContent = String(rows.length);

  if (!rows.length) {
    listBox.innerHTML = "";
    show(emptyBox);
    return;
  }

  hide(emptyBox);
  listBox.innerHTML = rows.map(rowCard).join("");
}

// ===============================
// Auth + Admin check
// ===============================
async function isAdmin() {
  // نتحقق من كون المستخدم موجود داخل جدول admins
  const { data: userRes } = await supa.auth.getUser();
  const user = userRes?.user;
  if (!user) return false;

  const { data, error } = await supa
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

async function refreshSessionUI() {
  const loginCard = document.getElementById("loginCard");
  const adminPanel = document.getElementById("adminPanel");
  const logoutBtn = document.getElementById("logoutBtn");

  const { data } = await supa.auth.getSession();
  const session = data?.session;

  if (!session) {
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    return;
  }

  const ok = await isAdmin();
  if (!ok) {
    // مسجل دخول لكن مو أدمن → نسجله خروج
    await supa.auth.signOut();
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setMsg("هذا الحساب ليس ضمن الأدمن المصرّح لهم.");
    return;
  }

  hide(loginCard); show(adminPanel); show(logoutBtn);
  await loadAllRows();
}

// ===============================
// Data
// ===============================
async function loadAllRows() {
  const listBox = document.getElementById("listBox");
  if (listBox) listBox.innerHTML = `<div class="text-center text-[12px] text-white/35 py-6">جاري التحميل...</div>`;

  const { data, error } = await supa
    .from("resources")
    .select("id, subject, note, file_url, file_path, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    if (listBox) listBox.innerHTML = `<div class="text-center text-[12px] text-red-300/80 py-6">تعذر تحميل البيانات</div>`;
    allRows = [];
    return;
  }

  allRows = data || [];
  renderList();
}

// ===============================
// Actions
// ===============================
async function setStatus(id, status) {
  const { error } = await supa
    .from("resources")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("فشل تحديث الحالة. تأكد من سياسات RLS للأدمن.");
    return false;
  }
  return true;
}

async function deleteRow(id) {
  // حذف السجل من DB فقط (والملف يبقى في Storage)
  // إذا تبي حذف الملف من Storage بعدين نضيفه (يتطلب Policy delete على storage.objects)
  const { error } = await supa
    .from("resources")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("فشل الحذف. تأكد من سياسات RLS للأدمن.");
    return false;
  }
  return true;
}

// ===============================
// Event wiring
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  // Login
  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) return setMsg("أدخل الإيميل والباسوورد.");

    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(error);
      return setMsg("بيانات الدخول غير صحيحة أو الحساب غير موجود.");
    }

    await refreshSessionUI();
  });

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supa.auth.signOut();
    await refreshSessionUI();
  });

  // Refresh
  document.getElementById("refreshBtn")?.addEventListener("click", async () => {
    await refreshSessionUI();
  });

  // Filter buttons
  document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      currentFilter = btn.getAttribute("data-filter") || "pending";
      renderList();
    });
  });

  // Search
  document.getElementById("searchBox")?.addEventListener("input", renderList);

  // Delegate actions
  document.getElementById("listBox")?.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const action = t.getAttribute("data-action");
    const idStr = t.getAttribute("data-id");
    if (!action || !idStr) return;

    const id = Number(idStr);
    if (!Number.isFinite(id)) return;

    if (action === "approve") {
      const ok = await setStatus(id, "approved");
      if (ok) await loadAllRows();
    }

    if (action === "pending") {
      const ok = await setStatus(id, "pending");
      if (ok) await loadAllRows();
    }

    if (action === "delete") {
      if (!confirm("أكيد تبغى تحذف السجل؟")) return;
      const ok = await deleteRow(id);
      if (ok) await loadAllRows();
    }
  });

  // initial
  await refreshSessionUI();
});
