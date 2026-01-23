const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ee_admin_auth_v1",
  },
});

let currentFilter = "pending";
let allRows = [];

// ---------- UI helpers ----------
function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function setMsg(text){
  const msg = document.getElementById("loginMsg");
  if (!msg) return;
  if (!text){ hide(msg); msg.textContent = ""; return; }
  msg.textContent = text;
  show(msg);
}

function setDebug(html){
  const box = document.getElementById("debugBox");
  if (box) box.innerHTML = html || "";
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[s]));
}

// ---------- auth ----------
async function getCurrentUserSafe(){
  const { data: sess } = await supa.auth.getSession();
  if (sess?.session?.user) return sess.session.user;
  const { data: usr } = await supa.auth.getUser();
  return usr?.user || null;
}

async function isAdminUser(user){
  const { data, error } = await supa
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admins select error]", error);
    return { ok: false, reason: `admins select error: ${error.message}` };
  }
  return { ok: !!data, reason: data ? "" : "not in admins table" };
}

async function refreshSessionUI(){
  const loginCard = document.getElementById("loginCard");
  const adminPanel = document.getElementById("adminPanel");
  const logoutBtn = document.getElementById("logoutBtn");
  const whoami = document.getElementById("whoami");

  const user = await getCurrentUserSafe();

  setDebug(user
    ? `Session: <b>${escapeHtml(user.email || "")}</b><br>UID: <code>${escapeHtml(user.id)}</code>`
    : `لا توجد Session حالياً`
  );

  if (!user){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    return;
  }

  const adminCheck = await isAdminUser(user);
  if (!adminCheck.ok){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setMsg("هذا الحساب ليس ضمن الأدمن المصرّح لهم. (" + adminCheck.reason + ")");
    await supa.auth.signOut();
    return;
  }

  hide(loginCard); show(adminPanel); show(logoutBtn);
  setMsg("");
  if (whoami) whoami.textContent = `مرحباً: ${user.email} — UID: ${user.id}`;

  await loadAllRows();
}

// ---------- data ----------
function rowCard(row){
  const subject = escapeHtml(row.subject || "");
  const note = row.note ? escapeHtml(row.note) : "";
  const status = row.status || "";
  const url = row.file_url || "#";

  const badge =
    status === "approved"
      ? `<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 font-bold">approved</span>`
      : `<span class="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 font-bold">pending</span>`;

  const approveBtn = status !== "approved"
    ? `<button data-action="approve" data-id="${row.id}" class="btn-brand px-4 py-2 rounded-xl text-xs font-black">اعتماد</button>`
    : "";

  const pendingBtn = status !== "pending"
    ? `<button data-action="pending" data-id="${row.id}" class="btn-ghost px-4 py-2 rounded-xl text-xs font-black">إرجاع Pending</button>`
    : "";

  return `
    <div class="btn-ghost rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="text-right">
        <div class="flex items-center gap-2 mb-1">
          <div class="font-black text-sm text-white/90">${subject}</div>
          ${badge}
        </div>
        ${note ? `<div class="text-[11px] text-white/40">${note}</div>` : ""}
      </div>

      <div class="flex flex-wrap gap-2">
        <a class="btn-ghost px-4 py-2 rounded-xl text-xs font-black" href="${url}" target="_blank" rel="noopener noreferrer">فتح</a>
        ${approveBtn}
        ${pendingBtn}
      </div>
    </div>
  `;
}

function renderList(){
  const listBox = document.getElementById("listBox");
  const emptyBox = document.getElementById("emptyBox");
  const countBadge = document.getElementById("countBadge");
  const q = (document.getElementById("searchBox")?.value || "").trim().toLowerCase();

  let rows = allRows;
  if (currentFilter !== "all") rows = rows.filter(r => r.status === currentFilter);
  if (q) rows = rows.filter(r => (r.subject || "").toLowerCase().includes(q));

  if (countBadge) countBadge.textContent = String(rows.length);

  if (!rows.length){
    if (listBox) listBox.innerHTML = "";
    show(emptyBox);
    return;
  }

  hide(emptyBox);
  if (listBox) listBox.innerHTML = rows.map(rowCard).join("");
}

async function loadAllRows(){
  const listBox = document.getElementById("listBox");
  if (listBox) listBox.innerHTML = `<div class="text-center text-sm text-white/40 py-8">جاري التحميل...</div>`;

  const { data, error } = await supa
    .from("resources")
    .select("id, subject, note, file_url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error){
    console.error("[resources select error]", error);
    if (listBox) listBox.innerHTML = `<div class="text-center text-sm text-red-200/80 py-8">فشل تحميل الموارد: ${escapeHtml(error.message)}</div>`;
    allRows = [];
    return;
  }

  allRows = data || [];
  renderList();
}

async function updateStatus(id, status){
  const { error } = await supa
    .from("resources")
    .update({ status })
    .eq("id", id);

  if (error){
    console.error("[resources update error]", error);
    alert("فشل تحديث الحالة: " + error.message);
    return false;
  }
  return true;
}

// ---------- wiring ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Login submit
  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      setMsg("أدخل الإيميل والباسوورد.");
      return;
    }

    setMsg("جاري تسجيل الدخول...");

    const { error } = await supa.auth.signInWithPassword({ email, password });

    if (error){
      console.error("[signIn error]", error);
      setMsg("فشل تسجيل الدخول: " + error.message);
      return;
    }

    setMsg("");
    await refreshSessionUI();
  });

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supa.auth.signOut();
    await refreshSessionUI();
  });

  // Refresh buttons
  document.getElementById("refreshBtn")?.addEventListener("click", refreshSessionUI);
  document.getElementById("refreshBtn2")?.addEventListener("click", refreshSessionUI);

  // Filters
  document.querySelectorAll(".filterBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.getAttribute("data-filter") || "pending";
      renderList();
    });
  });

  // Search
  document.getElementById("searchBox")?.addEventListener("input", renderList);

  // Actions
  document.getElementById("listBox")?.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const action = t.getAttribute("data-action");
    const idStr = t.getAttribute("data-id");
    if (!action || !idStr) return;

    const id = Number(idStr);
    if (!Number.isFinite(id)) return;

    if (action === "approve"){
      const ok = await updateStatus(id, "approved");
      if (ok) await loadAllRows();
    }

    if (action === "pending"){
      const ok = await updateStatus(id, "pending");
      if (ok) await loadAllRows();
    }
  });

  supa.auth.onAuthStateChange(async () => {
    await refreshSessionUI();
  });

  await refreshSessionUI();
});
