// ===============================
// Supabase Config
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===============================
// Helpers
// ===============================
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[s]));
}

function cardTemplate(item, mode) {
  // mode: "pending" | "approved"
  const created = item.created_at ? new Date(item.created_at).toLocaleString("ar-SA") : "";
  return `
    <div class="glass rounded-3xl p-5 flex items-start justify-between gap-4">
      <div class="text-right">
        <div class="font-black text-lg">${escapeHtml(item.subject)}</div>
        ${item.note ? `<div class="text-sm text-white/60 mt-1">${escapeHtml(item.note)}</div>` : ""}
        <div class="text-xs text-white/40 mt-2">تاريخ: ${escapeHtml(created)}</div>
        ${item.file_url ? `
          <a class="inline-block mt-3 text-sm underline text-indigo-300"
             href="${item.file_url}" target="_blank" rel="noopener noreferrer">فتح الملف</a>
        ` : ""}
      </div>

      <div class="flex flex-col gap-2 min-w-[140px]">
        ${mode === "pending" ? `
          <button data-action="approve" data-id="${item.id}"
            class="px-4 py-2 rounded-2xl bg-emerald-600 font-black">Approve</button>

          <button data-action="reject" data-id="${item.id}"
            class="px-4 py-2 rounded-2xl bg-amber-600 font-black">Reject</button>

          <button data-action="delete" data-id="${item.id}"
            class="px-4 py-2 rounded-2xl bg-rose-600 font-black">Delete</button>
        ` : `
          <span class="px-4 py-2 rounded-2xl bg-white/10 font-black text-center">Approved</span>
        `}
      </div>
    </div>
  `;
}

// ===============================
// DOM
// ===============================
const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMsg = document.getElementById("loginMsg");

const refreshBtn = document.getElementById("refreshBtn");
const pendingList = document.getElementById("pendingList");
const approvedList = document.getElementById("approvedList");

// ===============================
// Auth
// ===============================
async function refreshSessionUI() {
  const { data } = await supa.auth.getSession();
  const session = data?.session;

  if (session) {
    loginMsg.textContent = `مسجل دخول: ${session.user.email}`;
    logoutBtn.classList.remove("hidden");
    adminPanel.classList.remove("hidden");
    await loadLists();
  } else {
    loginMsg.textContent = "غير مسجل دخول.";
    logoutBtn.classList.add("hidden");
    adminPanel.classList.add("hidden");
  }
}

loginBtn.addEventListener("click", async () => {
  loginMsg.textContent = "جاري تسجيل الدخول...";
  const email = emailEl.value.trim();
  const password = passEl.value;

  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    loginMsg.textContent = `خطأ: ${error.message}`;
    return;
  }
  await refreshSessionUI();
});

logoutBtn.addEventListener("click", async () => {
  await supa.auth.signOut();
  await refreshSessionUI();
});

// ===============================
// Load Data
// ===============================
async function loadLists() {
  // Pending
  pendingList.innerHTML = `<div class="text-sm text-white/60 text-center">جاري التحميل...</div>`;
  approvedList.innerHTML = `<div class="text-sm text-white/60 text-center">جاري التحميل...</div>`;

  // pending
  const pendingRes = await supa
    .from("resources")
    .select("id, subject, note, file_url, file_path, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (pendingRes.error) {
    pendingList.innerHTML = `<div class="text-sm text-rose-200 text-center">تعذر تحميل pending: ${escapeHtml(pendingRes.error.message)}</div>`;
  } else if (!pendingRes.data || pendingRes.data.length === 0) {
    pendingList.innerHTML = `<div class="text-sm text-white/40 text-center">لا توجد ملفات pending</div>`;
  } else {
    pendingList.innerHTML = pendingRes.data.map((x) => cardTemplate(x, "pending")).join("");
  }

  // approved
  const approvedRes = await supa
    .from("resources")
    .select("id, subject, note, file_url, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  if (approvedRes.error) {
    approvedList.innerHTML = `<div class="text-sm text-rose-200 text-center">تعذر تحميل approved: ${escapeHtml(approvedRes.error.message)}</div>`;
  } else if (!approvedRes.data || approvedRes.data.length === 0) {
    approvedList.innerHTML = `<div class="text-sm text-white/40 text-center">لا توجد ملفات معتمدة حالياً</div>`;
  } else {
    approvedList.innerHTML = approvedRes.data.map((x) => cardTemplate(x, "approved")).join("");
  }
}

refreshBtn.addEventListener("click", loadLists);

// ===============================
// Actions (Approve/Reject/Delete)
// ===============================
document.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = Number(btn.getAttribute("data-id"));
  if (!id) return;

  // تأكيد للحذف
  if (action === "delete") {
    const ok = confirm("تأكيد حذف السجل؟ (سيحذف من قاعدة البيانات فقط)");
    if (!ok) return;
  }

  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = "جارٍ التنفيذ...";

  try {
    if (action === "approve") {
      const { error } = await supa
        .from("resources")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw error;

    } else if (action === "reject") {
      const { error } = await supa
        .from("resources")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;

    } else if (action === "delete") {
      const { error } = await supa
        .from("resources")
        .delete()
        .eq("id", id);

      if (error) throw error;
    }

    await loadLists();

  } catch (err) {
    alert("خطأ: " + (err?.message || err));
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

// Init
refreshSessionUI();
