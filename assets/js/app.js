// ===============================
// Supabase Client
// ===============================
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===============================
// DOM
// ===============================
const approvedBox = document.getElementById("approvedResources");

// إذا ما كان موجود في الصفحة، لا تسوي شيء
if (approvedBox) {
  loadPublicResources();
}

// ===============================
// Helpers
// ===============================
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (s) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function groupByCategory(items) {
  const map = new Map();
  for (const it of items) {
    const key = (it.category && String(it.category).trim()) ? String(it.category).trim() : "بدون تصنيف";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return map;
}

async function callFilesApi(action, payload) {
  const res = await supa.functions.invoke("files-api", {
    body: { action, payload: payload ?? {} },
  });

  if (res.error) throw new Error(res.error.message || String(res.error));
  if (res.data && res.data.error) throw new Error(res.data.error);
  return res.data;
}

// ===============================
// Main
// ===============================
async function loadPublicResources() {
  approvedBox.innerHTML = `
    <div class="text-center text-[10px] text-white/30">جاري تحميل المصادر...</div>
  `;

  try {
    const data = await callFilesApi("list_public", {});
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      approvedBox.innerHTML = `
        <div class="text-center text-[10px] text-white/25">لا توجد مصادر منشورة حالياً</div>
      `;
      return;
    }

    // تجميع حسب التصنيف
    const grouped = groupByCategory(items);

    let html = "";
    for (const [cat, arr] of grouped.entries()) {
      html += `
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <div class="font-black text-sm text-white/80">${escapeHtml(cat)}</div>
            <div class="text-[10px] text-white/30">${arr.length} ملف</div>
          </div>

          <div class="space-y-3">
            ${arr.map(r => `
              <div class="btn-ghost rounded-2xl p-4 flex items-center justify-between gap-3">
                <div class="text-right">
                  <div class="font-black text-sm text-white/85">${escapeHtml(r.subject)}</div>
                  ${r.note ? `<div class="text-[10px] text-white/35 mt-1">${escapeHtml(r.note)}</div>` : ""}
                  ${Array.isArray(r.tags) && r.tags.length ? `
                    <div class="mt-2 flex flex-wrap gap-1 justify-end">
                      ${r.tags.slice(0, 6).map(t => `
                        <span class="text-[9px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                          ${escapeHtml(t)}
                        </span>
                      `).join("")}
                    </div>
                  ` : ""}
                </div>

                <a class="btn-brand px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap"
                   href="${r.download_url || "#"}"
                   ${r.download_url ? `target="_blank" rel="noopener noreferrer"` : `aria-disabled="true"`}
                   style="${r.download_url ? "" : "opacity:.5; pointer-events:none;"}">
                  تحميل
                </a>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    approvedBox.innerHTML = html;

  } catch (err) {
    console.error(err);
    approvedBox.innerHTML = `
      <div class="text-center text-[10px] text-red-300/70">
        تعذر تحميل المصادر: ${escapeHtml(err?.message || String(err))}
      </div>
    `;
  }
}
