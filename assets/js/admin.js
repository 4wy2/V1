const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ضع إيميلك هنا ليفعل لك صلاحيات السوبر أدمن ---
const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com
    "; 

let allRows = [];
let currentFilter = "pending";
let currentAdminName = "";
let currentAdminEmail = "";

// دالة الدخول
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supa.auth.signInWithPassword({ email, password });

    if (error) {
        alert("خطأ في الدخول: " + error.message);
    } else {
        checkUser();
    }
});

// التحقق من الجلسة وتثبيت الاسم
async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    
    if (session) {
        currentAdminEmail = session.user.email;
        document.getElementById("loginCard").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        
        const { data: admin } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
        currentAdminName = admin?.full_name || currentAdminEmail.split('@')[0];
        
        // تثبيت الهوية في الهيدر
        document.getElementById("whoami").innerHTML = `
            <span class="text-blue-400 text-[10px] block uppercase">المشرف ${currentAdminEmail === SUPER_ADMIN_EMAIL ? 'العام' : ''}</span>
            <span class="text-white font-black text-lg">${currentAdminName}</span>
        `;
        
        loadData();
    }
}

async function loadData() {
    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    allRows = data || [];
    render();
}

function render() {
    const desktop = document.getElementById("desktopList");
    const mobile = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();

    // تحديث الإنجازات
    const today = new Date().toLocaleDateString();
    const stats = {
        today: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === today).length,
        total: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length,
        review: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length
    };

    document.getElementById("productivityStats").innerHTML = `
        <div class="flex justify-around items-center text-center">
            <div><p class="text-[10px] text-blue-400 font-bold">إنجازك اليوم</p><p class="font-black text-xl text-white">${stats.today}</p></div>
            <div class="w-[1px] h-8 bg-slate-800"></div>
            <div><p class="text-[10px] text-amber-400 font-bold">تحت يدك</p><p class="font-black text-xl text-white">${stats.review}</p></div>
            <div class="w-[1px] h-8 bg-slate-700"></div>
            <div><p class="text-[10px] text-emerald-400 font-bold">إجمالي بصمتك</p><p class="font-black text-xl text-white">${stats.total}</p></div>
        </div>
    `;

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const btnLogic = (row) => {
        const isSuper = currentAdminEmail === SUPER_ADMIN_EMAIL;
        const isMe = row.processed_by === currentAdminName;
        const isFree = !row.processed_by || row.processed_by === "" || row.processed_by === "--";

        let html = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;

        // منطق الأزرار للسوبر أدمن والمشرف
        if (isFree || isSuper) {
            if (row.status === 'pending') {
                html += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">حجز للمراجعة</button>`;
            }
        }

        if (isMe || isSuper) {
            if (row.status === 'reviewing') {
                html += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md">اعتماد ✅</button>`;
                html += `<button onclick="release(${row.id})" class="text-slate-500 text-[10px] border border-slate-800 px-2 py-2 rounded-lg">إلغاء الحجز</button>`;
            } else if (row.status === 'approved') {
                html += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب النشر</button>`;
            }
        } else if (!isFree && !isMe) {
            html += `<span class="text-[9px] text-slate-500 italic bg-slate-900 px-3 py-2 rounded-xl">🔒 مع ${row.processed_by}</span>`;
        }
        return html;
    };

    desktop.innerHTML = filtered.map(row => `
        <tr class="border-b border-slate-800/50 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-40' : ''}">
            <td class="p-4">
                <div class="font-black text-white text-xs">${row.subject}</div>
                <div class="text-[9px] text-amber-500 mt-1 italic">📌 نوتة الطالب: ${row.description || 'لا يوجد'}</div>
            </td>
            <td class="p-4"><textarea onchange="updateNote(${row.id}, this.value)" class="w-full h-10 p-2 text-[10px] bg-black/20 border border-slate-800 rounded-lg text-slate-300" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea></td>
            <td class="p-4 text-center text-[10px] text-slate-500 font-bold">${row.processed_by || '--'}</td>
            <td class="p-4"><div class="flex gap-2 justify-end">${btnLogic(row)}</div></td>
        </tr>
    `).join("");

    mobile.innerHTML = filtered.map(row => `
        <div class="bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 space-y-4">
            <div class="flex justify-between items-center"><span class="font-black text-white text-sm">${row.subject}</span><span class="text-[9px] text-blue-500 font-bold">${row.processed_by || 'متاح'}</span></div>
            <div class="bg-amber-500/5 p-3 rounded-xl text-[10px] text-amber-600 italic border-r-2 border-amber-500/30">📝 ${row.description || 'لا يوجد وصف'}</div>
            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-[10px] h-20 bg-black/40 rounded-2xl" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap pt-2">${btnLogic(row)}</div>
        </div>
    `).join("");
    
    document.getElementById("totalCount").textContent = allRows.length;
}

window.updateStatus = async (id, s) => {
    await supa.from("resources").update({ status: s, processed_by: currentAdminName, updated_at: new Date().toISOString() }).eq("id", id);
    loadData();
};

window.updateNote = async (id, n) => {
    await supa.from("resources").update({ admin_note: n, processed_by: currentAdminName }).eq("id", id);
};

window.release = async (id) => {
    await supa.from("resources").update({ processed_by: null, status: 'pending' }).eq("id", id);
    loadData();
};

document.querySelectorAll(".filterBtn").forEach(b => b.onclick = () => {
    currentFilter = b.dataset.filter;
    document.querySelectorAll(".filterBtn").forEach(x => x.classList.remove("bg-blue-600", "text-white"));
    b.classList.add("bg-blue-600", "text-white");
    render();
});

checkUser();
