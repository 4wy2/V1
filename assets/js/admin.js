const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = "pending";

let currentAdminName = "";
let currentAdminEmail = "";
let currentAdminUserId = "";
let isSuperAdmin = false;

// ================= AUTH =================
document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = e.target.querySelector("button");
  btn.innerText = "جاري التحقق...";

  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    alert("خطأ: " + error.message);
    btn.innerText = "دخول النظام";
    return;
  }

  await checkUser();
};

async function checkUser() {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) return;

  currentAdminEmail = session.user.email || "";
  currentAdminUserId = session.user.id;

  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");

  const { data: admin } = await supa
    .from("admins")
    .select("full_name,is_super")
    .eq("user_id", currentAdminUserId)
    .maybeSingle();

  currentAdminName = admin?.full_name || currentAdminEmail.split("@")[0];
  isSuperAdmin = !!admin?.is_super;

  document.getElementById("whoami").innerHTML = `
    <span class="text-blue-400 text-[10px] block font-black uppercase tracking-tighter">المشرف المسؤول</span>
    <span class="text-white font-black text-lg">${currentAdminName}</span>
    ${isSuperAdmin ? `<span class="text-[10px] text-amber-400 font-black block mt-1">Super Admin</span>` : ""}
  `;

  await loadData();
}

// ================= DATA =================
async function loadData() {
  const { data, error } = await supa
    .from("resources")
    .select("id,subject,file_url,status,admin_note,processed_by_user_id,processed_by_name,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    alert("تعذر تحميل البيانات: " + error.message);
    return;
  }

  allRows = data || [];
  render();
}

// ================= RENDER =================
function render() {
  const desktop = document.getElementById("desktopList");
  const mobile = document.getElementById("mobileList");
  const search = (document.getElementById("searchBox").value || "").toLowerCase();

  const todayStr = new Date().toLocaleDateString();
  const stats = {
    today: allRows.filter(r =>
      r.processed_by_user_id === currentAdminUserId &&
      r.status === "approved" &&
      r.updated_at &&
      new Date(r.updated_at).toLocaleDateString() === todayStr
    ).length,
    total: allRows.filter(r =>
      r.processed_by_user_id === currentAdminUserId &&
      r.status === "approved"
    ).length,
    review: allRows.filter(r =>
      r.processed_by_user_id === currentAdminUserId &&
      r.status === "reviewing"
    ).length
  };

  document.getElementById("productivityStats").innerHTML = `
    <div class="flex justify-around items-center h-full gap-2">
      <div class="text-center flex-1"><p class="text-[9px] text-blue-400 font-bold">أنجزت اليوم</p><p class="text-xl font-black text-white">${stats.today}</p></div>
      <div class="w-px h-8 bg-slate-700"></div>
      <div class="text-center flex-1"><p class="text-[9px] text-amber-500 font-bold">قيد المراجعة</p><p class="text-xl font-black text-white">${stats.review}</p></div>
      <div class="w-px h-8 bg-slate-700"></div>
      <div class="text-center flex-1"><p class="text-[9px] text-emerald-400 font-bold">الإجمالي</p><p class="text-xl font-black text-white">${stats.total}</p></div>
    </div>
  `;

  const filtered = allRows.filter(r => {
    const matchStatus = (currentFilter === "all" || r.status === currentFilter);
    const matchSearch = (r.subject || "").toLowerCase().includes(search);
    return matchStatus && matchSearch;
  });

  const statusAr = s => s === "pending" ? "جديد" : s === "reviewing" ? "قيد المراجعة" : s === "approved" ? "تم النشر" : s;

  const getBtns = (row) => {
    const isMe = row.processed_by_user_id === currentAdminUserId;
    const isFree = !row.processed_by_user_id;

    let btns = `
      <a href="${row.file_url}" target="_blank"
         class="flex-1 bg-blue-600/20 text-blue-400 py-3 rounded-xl text-center text-[10px] font-black border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all">
        فتح
      </a>
    `;

    if ((isFree || isSuperAdmin) && row.status === "pending") {
      btns += `
        <button onclick="claim(${row.id})"
                class="flex-[2] bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black">
          حجز للمراجعة ✋
        </button>
      `;
    }

    if (isMe || isSuperAdmin) {
      if (row.status === "reviewing") {
        btns += `
          <button onclick="updateStatus(${row.id}, 'approved')"
                  class="flex-[2] bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black">
            نشر الملف ✅
          </button>
          <button onclick="release(${row.id})"
                  class="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-[10px]">
            إلغاء
          </button>
        `;
      } else if (row.status === "approved") {
        btns += `
          <button onclick="updateStatus(${row.id}, 'pending')"
                  class="flex-[2] bg-red-500/10 text-red-500 py-3 rounded-xl text-[10px] font-black">
            سحب النشر
          </button>
        `;
      }
    } else if (!isFree && !isMe) {
      btns = `
        <div class="w-full text-center py-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[10px] text-slate-500 italic">
          🔒 الملف محجوز
        </div>
      `;
    }

    return btns;
  };

  desktop.innerHTML = filtered.map(row => `
    <tr class="archive-item ${row.processed_by_user_id && row.processed_by_user_id !== currentAdminUserId ? "opacity-40" : ""}">
      <td class="p-4 rounded-r-2xl border-y border-r border-slate-800">
        <div class="font-black text-white text-sm">${row.subject || "--"}</div>
      </td>
      <td class="p-4 border-y border-slate-800">
        <textarea onchange="updateNote(${row.id}, this.value)"
                  class="w-full h-12 p-3 text-[11px] bg-black/40 border border-slate-800 rounded-xl"
                  ${row.processed_by_user_id && row.processed_by_user_id !== currentAdminUserId && !isSuperAdmin ? "disabled" : ""}>${row.admin_note || ""}</textarea>
      </td>
      <td class="p-4 border-y border-slate-800 text-center text-blue-400/50 font-black text-[10px] uppercase">
        ${row.processed_by_name || "--"}
      </td>
      <td class="p-4 rounded-l-2xl border-y border-l border-slate-800 min-w-[220px]">
        <div class="flex gap-2">${getBtns(row)}</div>
      </td>
    </tr>
  `).join("");

  mobile.innerHTML = filtered.map(row => `
    <div class="archive-item p-5 rounded-[2.2rem] space-y-4">
      <div class="flex justify-between">
        <h3 class="font-black text-white text-lg">${row.subject || "--"}</h3>
        <div class="text-left font-black text-[10px] text-blue-400 opacity-60">
          ${row.processed_by_name || "متاح"}
        </div>
      </div>
      <textarea onchange="updateNote(${row.id}, this.value)"
                class="w-full p-4 text-[12px] h-24 bg-black/40 border border-slate-800 rounded-2xl"
                ${row.processed_by_user_id && row.processed_by_user_id !== currentAdminUserId && !isSuperAdmin ? "disabled" : ""}>${row.admin_note || ""}</textarea>
      <div class="flex gap-2 pt-2">${getBtns(row)}</div>
    </div>
  `).join("");

  document.getElementById("totalCount").textContent = allRows.length;
}

// ================= ACTIONS =================
window.claim = async (id) => {
  const { data, error } = await supa.rpc("claim_resource", { p_resource_id: id });
  if (error) return alert("فشل الحجز: " + error.message);
  if (!data) return alert("تم حجز الملف من شخص آخر.");
  await loadData();
};

window.updateStatus = async (id, s) => {
  const payload = {
    status: s,
    processed_by_user_id: currentAdminUserId,
    processed_by_name: currentAdminName,
    updated_at: new Date().toISOString()
  };

  const { error } = await supa.from("resources").update(payload).eq("id", id);
  if (error) return alert("فشل التحديث: " + error.message);
  await loadData();
};

window.updateNote = async (id, n) => {
  const { error } = await supa.from("resources")
    .update({
      admin_note: n,
      processed_by_user_id: currentAdminUserId,
      processed_by_name: currentAdminName
    })
    .eq("id", id);

  if (error) alert("فشل حفظ الملاحظة: " + error.message);
};

window.release = async (id) => {
  const { error } = await supa.from("resources")
    .update({
      processed_by_user_id: null,
      processed_by_name: null,
      status: "pending"
    })
    .eq("id", id);

  if (error) return alert("فشل الإلغاء: " + error.message);
  await loadData();
};

document.querySelectorAll(".filterBtn").forEach(b => b.onclick = () => {
  currentFilter = b.dataset.filter;
  document.querySelectorAll(".filterBtn").forEach(x => x.classList.remove("bg-blue-600", "text-white"));
  b.classList.add("bg-blue-600", "text-white");
  render();
});

checkUser();
