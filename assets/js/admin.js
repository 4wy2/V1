console.log("ADMIN.JS LOADED ✅");

const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

if (!window.supabase) {
  alert("Supabase JS لم يتم تحميله. تأكد من رابط CDN.");
  throw new Error("supabase-js not loaded");
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
function qs(id){ return document.getElementById(id); }
function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[s]));
}

function setLoginMsg(text){
  const msg = qs("loginMsg");
  if (!msg) return;
  if (!text){ hide(msg); msg.textContent=""; return; }
  msg.textContent = text;
  show(msg);
}

function setPanelMsg(text){
  const msg = qs("panelMsg");
  if (!msg) return;
  if (!text){ hide(msg); msg.textContent=""; return; }
  msg.textContent = text;
  show(msg);
}

function setDebug(html){
  const box = qs("debugBox");
  if (box) box.innerHTML = html || "";
}

function setLoading(text){
  const listBox = qs("listBox");
  if (listBox) listBox.innerHTML = `<div class="text-center text-sm text-white/40 py-8">${escapeHtml(text)}</div>`;
}

// ---------------- Auth helpers ----------------
async function getCurrentUserSafe(){
  const { data: sess } = await supa.auth.getSession();
  if (sess?.session?.user) return sess.session.user;
  const { data: usr } = await supa.auth.getUser();
  return usr?.user || null;
}

async function checkIsAdmin(user){
  const { data, error } = await supa
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admins select error]", error);
    return { ok: false, reason: `admins select error: ${error.message}` };
  }
  if (!data) return { ok: false, reason: "not found in admins table" };
  return { ok: true, reason: "" };
}

async function refreshUI(){
  const loginCard = qs("loginCard");
  const adminPanel = qs("adminPanel");
  const logoutBtn = qs("logoutBtn");
  const whoami = qs("whoami");

  const user = await getCurrentUserSafe();

  setDebug(user
    ? `Session: <b>${escapeHtml(user.email || "")}</b><br>UID: <code>${escapeHtml(user.id)}</code>`
    : `لا توجد Session حالياً`
  );

  if (!user){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setLoginMsg("");
    setPanelMsg("");
    return;
  }

  const adminCheck = await checkIsAdmin(user);
  if (!adminCheck.ok){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setLoginMsg("هذا الحساب ليس ضمن الأدمن المصرّح لهم. (" + adminCheck.reason + ")");
    return;
  }

  hide(loginCard); show(adminPanel); show(logoutBtn);
  setLoginMsg("");
  setPanelMsg("");

  if (whoami) whoami.textContent = `مرحباً: ${user.email} — UID: ${user.id}`;

  await loadAllRows();
}

// ---------------- Data rendering ----------------
function rowCard(row){
  const subject = escapeHtml(row.subject || "");
  const note = row.note ? escapeHtml(row.note) : "";
  const status = row.status || "";
  const url = row.file_url || "#";
  const created = row.created_at ? new Date(row.created_at).toLocaleString("ar-SA") : "";

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

  const deleteBtn =
    `<button data-action="delete" data-id="${row.id}" class="btn-ghost px-4 py-2 rounded-xl text-xs font-black border border-red-500/30 text-red-200/90 hover:bg-red-500/10">حذف</button>`;

  return `
    <div class="btn-ghost rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="text-right">
        <div class="flex items-center gap-2 mb-1">
          <div class="font-black text-sm text-white/90">${subject}</div>
          ${badge}
        </div>
        ${note ? `<div class="text-[11px] text-white/40">${note}</div>` : ""}
        <div class="text-[10px] text-white/25 mt-1">${escapeHtml(created)}</div>
      </div>

      <div class="flex flex-wrap gap-2 justify-start sm:justify-end">
        <a class="btn-ghost px-4 py-2 rounded-xl text-xs font-black" href="${url}" target="_blank" rel="noopener noreferrer">فتح</a>
        ${approveBtn}
        ${pendingBtn}
        ${deleteBtn}
      </div>
    </div>
  `;
}

function renderList(){
  const listBox = qs("listBox");
  const emptyBox = qs("emptyBox");
  const countBadge = qs("countBadge");
  const q = (qs("searchBox")?.value || "").trim().toLowerCase();

  let rows = allRows.slice();

  if (currentFilter !== "all") rows = rows.filter(r => (r.status || "") === currentFilter);
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

// ---------------- DB ops ----------------
async function loadAllRows(){
  setLoading("جاري تحميل البيانات...");

  const { data, error } = await supa
    .from("resources")
    .select("id, subject, note, file_url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error){
    console.error("[resources select error]", error);
    setLoading("فشل تحميل البيانات: " + error.message);
    setPanelMsg("مشكلة SELECT على resources: " + error.message);
    allRows = [];
    return;
  }

  allRows = data || [];
  setPanelMsg("");
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

async function deleteRow(id){
  const { error } = await supa
    .from("resources")
    .delete()
    .eq("id", id);

  if (error){
    console.error("[resources delete error]", error);
    alert("فشل الحذف: " + error.message);
    return false;
  }
  return true;
}

// ---------------- Wiring ----------------
document.addEventListener("DOMContentLoaded", async ()=>{
  qs("loginForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    setLoginMsg("");

    const email = qs("email")?.value?.trim();
    const password = qs("password")?.value;

    if (!email || !password){
      setLoginMsg("أدخل الإيميل وكلمة المرور.");
      return;
    }

    setLoginMsg("جاري تسجيل الدخول...");

    const { error } = await supa.auth.signInWithPassword({ email, password });

    if (error){
      console.error("[signIn error]", error);
      setLoginMsg("فشل تسجيل الدخول: " + error.message);
      return;
    }

    setLoginMsg("");
    await refreshUI();
  });

  qs("logoutBtn")?.addEventListener("click", async ()=>{
    await supa.auth.signOut();
    await refreshUI();
  });

  qs("refreshBtn")?.addEventListener("click", refreshUI);
  qs("refreshBtn2")?.addEventListener("click", refreshUI);

  document.querySelectorAll(".filterBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      currentFilter = btn.getAttribute("data-filter") || "pending";
      renderList();
    });
  });

  qs("searchBox")?.addEventListener("input", renderList);

  qs("listBox")?.addEventListener("click", async (e)=>{
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

    if (action === "delete"){
      if (!confirm("أكيد تبغى تحذف السجل؟")) return;
      const ok = await deleteRow(id);
      if (ok) await loadAllRows();
    }
  });

  supa.auth.onAuthStateChange(async ()=>{
    await refreshUI();
  });

  await refreshUI();
});
