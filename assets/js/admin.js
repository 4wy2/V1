// ===============================
// Supabase Client
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";

// لازم يكون anon public JWT (eyJ...) من Settings → API
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===============================
// DOM
// ===============================
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resetBtn = document.getElementById("resetBtn");

const loginMsg = document.getElementById("loginMsg");
const panel = document.getElementById("panel");

const qEl = document.getElementById("q");
const pubFilterEl = document.getElementById("pubFilter");
const sortEl = document.getElementById("sort");
const listEl = document.getElementById("list");

let ALL_ITEMS = [];

// ===============================
// Helpers
// ===============================
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (s) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function formatDate(dt) {
  try { return dt ? new Date(dt).toLocaleString("ar-SA") : ""; }
  catch { return String(dt || ""); }
}

function toTagsArray(tagsStr) {
  const raw = String(tagsStr || "").trim();
  if (!raw) return null;
  return raw.split(",").map(t => t.trim()).filter(Boolean);
}

function showErrorBox(title, detail) {
  listEl.innerHTML = `
    <div class="glass rounded-3xl p-5 border border-rose-500/20">
      <div class="text-right">
        <div class="font-black text-rose-200">${escapeHtml(title)}</div>
        <div class="mt-2 text-sm text-white/70 whitespace-pre-wrap">${escapeHtml(detail)}</div>
        <div class="mt-3 text-xs text-white/40">
          جرّب: اضغط "إعادة ضبط" ثم سجّل دخول من جديد.
        </div>
      </div>
    </div>
  `;
}

// ===============================
// Edge Function call (FETCH) ✅
// ===============================
async function callFilesApi(action, payload) {
  const url = `${SUPABASE_URL}/functions/v1/files-api`;

  const { data: sess } = await supa.auth.getSession();
  const token = sess?.session?.access_token;

  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload: payload ?? {} }),
  });

  const text = await r.text();

  let body = null;
  try { body = JSON.parse(text); } catch {}

  if (!r.ok) {
    const msg = (body && (body.error || body.message))
      ? (body.error || body.message)
      : text;
    throw new Error(`HTTP ${r.status}: ${msg}`);
  }

  if (body && body.error) throw new Error(String(body.error));
  return body ?? {};
}

// ===============================
// UI Session
// ===============================
async function refreshSessionUI() {
  const { data } = await supa.auth.getSession();
  const session = data?.session;

  if (session) {
    loginMsg.textContent = `مسجل دخول: ${session.user.email}`;
    logoutBtn.classList.remove("hidden");
    refreshBtn.classList.remove("hidden");
    panel.classList.remove("hidden");
    await loadAll();
  } else {
    loginMsg.textContent = "غير مسجل دخول.";
    logoutBtn.classList.add("hidden");
    refreshBtn.classList.add("hidden");
    panel.classList.add("hidden");
    listEl.innerHTML = "";
    ALL_ITEMS = [];
  }
}

// ===============================
// Auth Buttons
// ===============================
loginBtn.addEventListener("click", async () => {
  loginMsg.textContent = "جاري تسجيل الدخول...";
  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

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

refreshBtn.addEventListener("click", async () => {
  await loadAll();
});

// زر إعادة ضبط (بدون Console)
resetBtn.addEventListener("click", async () => {
  try { await supa.auth.signOut(); } catch {}
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  location.reload();
});

// ===============================
// Load
// ===============================
async function loadAll() {
  listEl.innerHTML = `<div class="text-center text-sm text-white/60">جاري تحميل الملفات...</div>`;

  try {
    const data = await callFilesApi("admin_list_all", {});
    ALL_ITEMS = Array.isArray(data?.items) ? data.items : [];

    if (!ALL_ITEMS.length) {
      listEl.innerHTML = `<div class="text-center text-sm text-white/50">لا توجد ملفات في جدول resources.</div>`;
      return;
    }

    renderList();
  } catch (e) {
    console.error(e);
    ALL_ITEMS = [];
    showErrorBox("تعذر التحميل من Edge Function", e?.message || String(e));
  }
}

// ===============================
// Render
// ===============================
function renderList() {
  if (!Array.isArray(ALL_ITEMS) || ALL_ITEMS.length === 0) {
    listEl.innerHTML = `<div class="text-center text-sm text-white/50">لا توجد بيانات.</div>`;
    return;
  }

  const q = (qEl.value || "").trim().toLowerCase();
  const pubFilter = pubFilterEl.value;
  const sort = sortEl.value;

  let items = [...ALL_ITEMS];

  if (pubFilter === "public") items = items.filter(i => i.is_public === true);
  if (pubFilter === "private") items = items.filter(i => i.is_public !== true);

  if (q) {
    items = items.filter(i => {
      const hay = [
        i.subject || "",
        i.note || "",
        i.category || "",
        Array.isArray(i.tags) ? i.tags.join(",") : ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a, b) => {
    const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return sort === "old" ? (da - db) : (db - da);
  });

  drawItems(items);
}

function drawItems(items) {
  if (!items.length) {
    listEl.innerHTML = `<div class="text-center text-sm text-white/50">لا توجد نتائج</div>`;
    return;
  }

  listEl.innerHTML = items.map(r => {
    const pubBadge = r.is_public ? "Public" : "Private";
    const pubClass = r.is_public ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70";
    const tagsStr = Array.isArray(r.tags) ? r.tags.join(", ") : "";

    return `
      <div class="glass rounded-3xl p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="text-right">
            <div class="flex items-center gap-2 justify-end">
              <span class="px-3 py-1 rounded-full text-xs font-black ${pubClass}">${pubBadge}</span>
              <div class="font-black text-lg">${escapeHtml(r.subject)}</div>
            </div>

            ${r.note ? `<div class="text-sm text-white/60 mt-2">${escapeHtml(r.note)}</div>` : ""}
            <div class="text-xs text-white/40 mt-2">تاريخ: ${escapeHtml(formatDate(r.created_at))}</div>

            ${r.download_url ? `
              <a class="inline-block mt-3 text-sm underline text-indigo-300"
                 href="${r.download_url}" target="_blank" rel="noopener noreferrer">تحميل</a>
            ` : `<div class="text-xs text-white/40 mt-3">لا يوجد رابط تحميل</div>`}
          </div>

          <div class="flex flex-col gap-2 min-w-[180px]">
            <button class="btnAction px-4 py-2 rounded-2xl bg-white/10 font-black"
              data-action="toggle_public" data-id="${escapeHtml(r.id)}" data-current="${r.is_public ? "1" : "0"}">
              ${r.is_public ? "إلغاء النشر" : "نشر Public"}
            </button>

            <button class="btnAction px-4 py-2 rounded-2xl bg-rose-600 font-black"
              data-action="delete" data-id="${escapeHtml(r.id)}">
              حذف
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div>
            <label class="text-xs text-white/50">التصنيف</label>
            <input class="input w-full mt-1 cat" data-id="${escapeHtml(r.id)}"
              value="${escapeHtml(r.category || "")}" placeholder="مثال: Circuits">
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-white/50">Tags (افصل بفواصل)</label>
            <input class="input w-full mt-1 tags" data-id="${escapeHtml(r.id)}"
              value="${escapeHtml(tagsStr)}" placeholder="مثال: midterm, pdf, notes">
          </div>
        </div>

        <div class="mt-3 flex gap-2 justify-end">
          <button class="btnAction px-4 py-2 rounded-2xl bg-indigo-600 font-black"
            data-action="save" data-id="${escapeHtml(r.id)}">
            حفظ التعديلات
          </button>
        </div>
      </div>
    `;
  }).join("");
}

qEl.addEventListener("input", renderList);
pubFilterEl.addEventListener("change", renderList);
sortEl.addEventListener("change", renderList);

// ===============================
// Actions
// ===============================
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btnAction");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (!id) return;

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جارٍ التنفيذ...";

  try {
    if (action === "delete") {
      const ok = confirm("تأكيد حذف الملف؟ سيتم حذف السجل والملف من التخزين.");
      if (!ok) return;
      await callFilesApi("admin_delete", { id });
    }

    if (action === "toggle_public") {
      const cur = btn.getAttribute("data-current") === "1";
      await callFilesApi("admin_update", { id, is_public: !cur });
    }

    if (action === "save") {
      const catInput = document.querySelector(`input.cat[data-id="${CSS.escape(id)}"]`);
      const tagsInput = document.querySelector(`input.tags[data-id="${CSS.escape(id)}"]`);

      const category = catInput ? catInput.value.trim() : null;
      const tagsArr = tagsInput ? toTagsArray(tagsInput.value) : null;

      await callFilesApi("admin_update", { id, category: category || null, tags: tagsArr });
    }

    await loadAll();
  } catch (err) {
    console.error(err);
    alert("خطأ: " + (err?.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

// Start
refreshSessionUI();
