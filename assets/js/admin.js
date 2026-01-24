const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [], currentFilter = "pending", currentUser = { id: "", name: "", isSuper: false };

// دالة التحديث (تعمل في الجوال واللابتوب)
window.updateRowStatus = async (id, type) => {
    let updates = { status: type === 'claim' ? 'reviewing' : (type === 'release' ? 'pending' : 'approved') };
    if (type === 'claim') { updates.processed_by_user_id = currentUser.id; updates.processed_by_name = currentUser.name; }
    if (type === 'release') { updates.processed_by_user_id = null; updates.processed_by_name = null; }

    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (error) alert("خطأ: تأكد من إعدادات CORS في سوبابيس");
    else loadData();
};

async function loadData() {
    const { data } = await supa.from("resources").select("*").order("id", { ascending: false });
    allRows = data || [];
    render();
}

function render() {
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter));
    const items = filtered.map(row => {
        const rId = `'${row.id}'`;
        let btns = `<button onclick="window.updateRowStatus(${rId}, 'claim')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] cursor-pointer relative z-50">حجز</button>`;
        
        if (row.status === 'reviewing') {
            btns = `<button onclick="window.updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] cursor-pointer relative z-50">اعتماد</button>
                    <button onclick="window.updateRowStatus(${rId}, 'release')" class="bg-slate-700 text-white px-3 py-2 rounded-xl text-[10px] cursor-pointer relative z-50">إلغاء</button>`;
        }

        return {
            desktop: `<tr class="border-b border-slate-800/50">
                <td class="p-4 text-white font-bold">${row.subject}</td>
                <td class="p-4 text-blue-400 text-xs">${row.processed_by_name || "متاح"}</td>
                <td class="p-4"><div class="flex gap-2 justify-end relative z-50 pointer-events-auto">${btns}</div></td>
            </tr>`,
            mobile: `<div class="bg-slate-900/50 p-6 rounded-3xl mb-4">
                <h3 class="text-white mb-4">${row.subject}</h3>
                <div class="flex gap-2 relative z-50">${btns}</div>
            </div>`
        };
    });
    document.getElementById("desktopList").innerHTML = items.map(h => h.desktop).join("");
    document.getElementById("mobileList").innerHTML = items.map(h => h.mobile).join("");
}

// تسجيل الدخول والتشغيل
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;
    const { data: admin } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    currentUser = { id: session.user.id, name: admin?.full_name || "مشرف", isSuper: !!admin?.is_super };
    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    loadData();
}
checkUser();
