const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [], currentFilter = "pending", currentUser = { id: "", name: "", isSuper: false };

// --- نظام تسجيل الدخول (الإصلاح الجديد) ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        
        if (error) {
            alert("خطأ في تسجيل الدخول: " + error.message);
        } else {
            checkUser(); // التحقق من الرتبة والدخول بعد النجاح
        }
    };
}

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) return;

    const { data: admin } = await supa.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
    
    currentUser = {
        id: session.user.id,
        name: admin?.full_name || "مشرف",
        isSuper: !!admin?.is_super
    };

    document.getElementById("loginCard").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("leaderboardSection")?.classList.remove("hidden"); // إظهار لوحة الإنجاز
    
    document.getElementById("whoami").innerHTML = `
        <p class="text-blue-400 text-[10px] font-black uppercase">${currentUser.isSuper ? '👑 رئيس النظام' : '🛡️ مشرف مراجعة'}</p>
        <p class="text-white font-black text-lg">${currentUser.name}</p>
    `;
    loadData();
}

// --- معالجة البيانات والإنجازات ---
window.updateRowStatus = async (id, type) => {
    let updates = {};
    if (type === 'claim') updates = { status: 'reviewing', processed_by_user_id: currentUser.id, processed_by_name: currentUser.name };
    else if (type === 'release') updates = { status: 'pending', processed_by_user_id: null, processed_by_name: null };
    else if (type === 'approved') updates = { status: 'approved' };

    const { error } = await supa.from("resources").update(updates).eq("id", id);
    if (!error) loadData();
};

async function loadData() {
    const { data } = await supa.from("resources").select("*").order("id", { ascending: false });
    allRows = data || [];
    render();
}

function render() {
    // حساب لوحة الإنجاز (Leaderboard)
    const memberStats = {};
    allRows.forEach(r => {
        if (r.status === 'approved' && r.processed_by_name) {
            memberStats[r.processed_by_name] = (memberStats[r.processed_by_name] || 0) + 1;
        }
    });

    const leaderboardHtml = Object.entries(memberStats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                <div class="flex items-center gap-2">
                    <span class="text-blue-500 font-black">#${i+1}</span>
                    <p class="text-xs text-white">${name}</p>
                </div>
                <p class="text-sm font-black text-emerald-400">${count}</p>
            </div>
        `).join("");
    
    document.getElementById("teamLeaderboard").innerHTML = leaderboardHtml || '<p class="text-slate-500 text-xs">لا توجد إنجازات بعد</p>';

    // ريندر الجدول (مع دعم اللابتوب z-50)
    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter));
    const html = filtered.map(row => {
        const rId = `'${row.id}'`;
        let btns = `<button onclick="updateRowStatus(${rId}, 'claim')" class="bg-amber-600 text-white px-3 py-1 rounded-lg text-[10px] relative z-50 pointer-events-auto">حجز</button>`;
        
        if (row.status === 'reviewing' && (row.processed_by_user_id === currentUser.id || currentUser.isSuper)) {
            btns = `<button onclick="updateRowStatus(${rId}, 'approved')" class="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] relative z-50 pointer-events-auto">اعتماد</button>`;
        }

        return `
            <tr class="border-b border-slate-800/50">
                <td class="p-4 text-white text-xs">${row.subject}</td>
                <td class="p-4 text-blue-400 text-[10px] font-bold">${row.processed_by_name || "متاح"}</td>
                <td class="p-4 flex gap-2 justify-end">${btns}</td>
            </tr>`;
    }).join("");

    document.getElementById("desktopList").innerHTML = html;
}

checkUser(); // تشغيل التحقق التلقائي عند فتح الصفحة
