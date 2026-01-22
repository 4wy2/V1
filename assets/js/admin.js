const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loginMsg = document.getElementById("loginMsg");
const panel = document.getElementById("panel");

const qEl = document.getElementById("q");
const pubFilterEl = document.getElementById("pubFilter");
const sortEl = document.getElementById("sort");
const listEl = document.getElementById("list");

let allItems = [];

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (s) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[s]));
}

function toTagsArray(tagsStr) {
  const raw = String(tagsStr || "").trim();
  if (!raw) return null;
  return raw.split(",").map(t => t.trim()).filter(Boolean);
}

function formatDate(dt) {
  return dt ? new Date(dt).toLocaleString("ar-SA") : "";
}

async function callFilesApi(action, payload) {
  const { data, error } = await supa.functions.invoke("files-api", {
    body: { action, payload },
  });
  if (error) throw error;
  return data;
}

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
    allItems = [];
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

refreshBtn.addEventListener("click", () => loadAll());

async function loadAll() {
  listEl.innerHTML = `<div class="text-center text-sm text-white/60">جاري تحميل الملفات...</div>`;
  try {
    const res = await callFilesApi("admin_list_all", {});
    allItems = res.items || [];
    render();
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<div class="text-center text-sm text-red-200">تعذر التحميل: ${escapeHtml(e.message || e)}</div>`;
  }
}

function render() {
  const q = (qEl.value || "").trim().toLowerCase();
  const pubFilter = pubFilterEl.value;
  const sort = sortEl.value;

  let items = [...allItems];

  if (pubFilter === "public") items = items.filter(x => x.is_public === true);
  if (pubFilter === "private") items = items.filter(x => x.is_public !== true);

  if (q) {
    items = items.filter(x => {
      const hay = [
        x.subject, x.note, x.category,
        Array.isArray(x.tags) ? x.tags.join(",") : ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a, b) => {
    const da = new Date(a.created_at || 0).getTime();
    const db = new Date(b.created_at || 0).getTime();
    return sort === "old" ? (da - db) : (db - da);
  });

  if (!items.length) {
    listEl.innerHTML = `<div class="text-center text-sm text-white/50">لا توجد نتائج</div>`;
    return;
  }

  listEl.innerHTML = items.map(item => {
    const tagsStr = Array.isArray(item.tags) ? item.tags.join(", ") : "";
    const pubBadge = item.is_public ? "Public" : "Private";
    const pubClass = item.is_public ? "bg-emerald-600/20 text-emerald-200" : "bg-white/10 text-white/70";

    return `
      <div class="glass rounded-3xl p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="text-right">
            <div class="flex items-center gap-2 justify-end">
              <span class="px-3 py-1 rounded-full text-xs font-black ${pubClass}">${pubBadge}</span>
              <div class="font-black text-lg">${escapeHtml(item.subject)}</div>
            </div>

            ${item.note ? `<div class="text-sm text-white/60 mt-2">${escapeHtml(item.note)}</div>` : ""}
            <div class="text-xs text-white/40 mt-2">تاريخ: ${escapeHtml(formatDate(item.created_at))}</div>

            ${item.download_url ? `
              <a class="inline-block mt-3 text-sm underline text-indigo-300"
                 href="${item.download_url}" target="_blank" rel="noopener noreferrer">تحميل (رابط مؤقت)</a>
            ` : `<div class="text-xs text-white/40 mt-3">لا يوجد رابط تحميل</div>`}
          </div>

          <div class="flex flex-col gap-2 min-w-[180px]">
            <button class="btnAction px-4 py-2 rounded-2xl bg-white/10 font-black"
              data-action="toggle_public" data-id="${item.id}" data-current="${item.is_public ? "1" : "0"}">
              ${item.is_public ? "إلغاء النشر" : "نشر Public"}
            </button>

            <button class="btnAction px-4 py-2 rounded-2xl bg-rose-600 font-black"
              data-action="delete" data-id="${item.id}">
              حذف
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div>
            <label class="text-xs text-white/50">التصنيف</label>
            <input class="input w-full mt-1 cat" data-id="${item.id}" value="${escapeHtml(item.category || "")}" placeholder="مثال: Circuits">
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-white/50">Tags (افصل بفواصل)</label>
            <input class="input w-full mt-1 tags" data-id="${item.id}" value="${escapeHtml(tagsStr)}" placeholder="مثال: midterm, pdf, notes">
          </div>
        </div>

        <div class="mt-3 flex gap-2 justify-end">
          <button class="btnAction px-4 py-2 rounded-2xl bg-indigo-600 font-black"
            data-action="save" data-id="${item.id}">
            حفظ التعديلات
          </button>
        </div>
      </div>
    `;
  }).join("");
}

qEl.addEventListener("input", render);
pubFilterEl.addEventListener("change", render);
sortEl.addEventListener("change", render);

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btnAction");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = Number(btn.getAttribute("data-id"));
  if (!id) return;

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جارٍ التنفيذ...";

  try {
    if (action === "delete") {
      const ok = confirm("تأكيد حذف الملف؟ سيتم حذف السجل والملف من التخزين.");
      if (!ok) return;
      await callFilesApi("admin_delete", { id });

    } else if (action === "toggle_public") {
      const cur = btn.getAttribute("data-current") === "1";
      await callFilesApi("admin_update", { id, is_public: !cur });

    } else if (action === "save") {
      const catInput = document.querySelector(`input.cat[data-id="${id}"]`);
      const tagsInput = document.querySelector(`input.tags[data-id="${id}"]`);

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

refreshSessionUI();
