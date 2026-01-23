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

const ADMIN_TABLE_UID = "b454493b-ca82-4044-9943-575987d6858d";

let currentFilter = "pending";
let allRows = [];

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function setMsg(text){
  const msg = document.getElementById("loginMsg");
  if (!msg) return;
  if (!text){ hide(msg); msg.textContent=""; return; }
  msg.textContent = text;
  show(msg);
}

async function getCurrentUserSafe(){
  const { data: sess } = await supa.auth.getSession();
  if (sess?.session?.user) return sess.session.user;
  const { data: usr } = await supa.auth.getUser();
  return usr?.user || null;
}

async function refreshSessionUI(){
  const loginCard = document.getElementById("loginCard");
  const adminPanel = document.getElementById("adminPanel");
  const logoutBtn = document.getElementById("logoutBtn");

  const user = await getCurrentUserSafe();

  // ===== DEBUG 1: اعرض UID الحالي =====
  console.log("[DEBUG] current user:", user);
  if (user?.id) console.log("[DEBUG] current UID:", user.id, "expected admin UID:", ADMIN_TABLE_UID);

  if (!user){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setMsg("");
    return;
  }

  // تحقق من جدول admins
  const { data, error } = await supa
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // ===== DEBUG 2: نتيجة الاستعلام =====
  console.log("[DEBUG] admins select result:", { data, error });

  if (error || !data){
    show(loginCard); hide(adminPanel); hide(logoutBtn);
    setMsg("هذا الحساب ليس ضمن الأدمن المصرّح لهم.");
    await supa.auth.signOut();
    return;
  }

  hide(loginCard); show(adminPanel); show(logoutBtn);
  setMsg("");
  await loadAllRows();
}

// ====== بقية لوحة الإدارة (مختصر) ======
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[s]));
}
function rowCard(row){
  const subject = escapeHtml(row.subject||"");
  const note = row.note ? escapeHtml(row.note) : "";
  const status = row.status || "";
  const url = row.file_url || "#";

  return `
    <div class="btn-ghost rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="text-right">
        <div class="font-black text-sm text-white/90">${subject}</div>
        ${note ? `<div class="text-[11px] text-white/40 mt-1">${note}</div>` : ""}
        <div class="text-[10px] text-white/25 mt-1">${status}</div>
      </div>
      <div class="flex gap-2">
        <a class="btn-ghost px-4 py-2 rounded-xl text-xs font-black" href="${url}" target="_blank">فتح</a>
        ${status !== "approved" ? `<button data-action="approve" data-id="${row.id}" class="btn-brand px-4 py-2 rounded-xl text-xs font-black">اعتماد</button>` : ""}
      </div>
    </div>
  `;
}
async function loadAllRows(){
  const listBox = document.getElementById("listBox");
  if (listBox) listBox.innerHTML = `<div class="text-center text-[12px] text-white/35 py-6">جاري التحميل...</div>`;

  const { data, error } = await supa
    .from("resources")
    .select("id, subject, note, file_url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error){
    console.error(error);
    if (listBox) listBox.innerHTML = `<div class="text-center text-[12px] text-red-300/80 py-6">تعذر تحميل البيانات</div>`;
    allRows = [];
    return;
  }
  allRows = data || [];
  renderList();
}
function renderList(){
  const listBox = document.getElementById("listBox");
  const emptyBox = document.getElementById("emptyBox");
  const countBadge = document.getElementById("countBadge");
  if (!listBox || !emptyBox || !countBadge) return;

  countBadge.textContent = String(allRows.length);
  if (!allRows.length){
    listBox.innerHTML = "";
    show(emptyBox);
    return;
  }
  hide(emptyBox);
  listBox.innerHTML = allRows.map(rowCard).join("");
}

document.addEventListener("DOMContentLoaded", async ()=>{
  document.getElementById("loginForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    setMsg("");
    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error){
      console.error(error);
      setMsg("بيانات الدخول غير صحيحة.");
      return;
    }
    await refreshSessionUI();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async ()=>{
    await supa.auth.signOut();
    await refreshSessionUI();
  });

  document.getElementById("refreshBtn")?.addEventListener("click", async ()=>{
    await refreshSessionUI();
  });

  document.getElementById("listBox")?.addEventListener("click", async (e)=>{
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const action = t.getAttribute("data-action");
    const id = Number(t.getAttribute("data-id"));
    if (action === "approve" && Number.isFinite(id)){
      const { error } = await supa.from("resources").update({ status: "approved" }).eq("id", id);
      if (error){ console.error(error); alert("فشل اعتماد"); return; }
      await loadAllRows();
    }
  });

  supa.auth.onAuthStateChange(async ()=>{ await refreshSessionUI(); });

  await refreshSessionUI();
});
