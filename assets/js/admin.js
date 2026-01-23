const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; // غيره لإيميلك

let allRows = [];
let currentFilter = "pending";
let currentAdminName = "";
let currentAdminEmail = "";

// نظام الدخول
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري التحقق...";
    
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
        alert("خطأ: " + error.message);
        btn.innerText = "دخول النظام";
    } else {
        checkUser();
    }
};

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    if (session) {
        currentAdminEmail = session.user.email;
        document.getElementById("loginCard").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        const { data: admin } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
        currentAdminName = admin?.full_name || currentAdminEmail.split('@')[0];
        
        document.getElementById("whoami").innerHTML = `
            <span class="text-blue-400 text-[10px] block font-black uppercase tracking-tighter">المشرف المسؤول</span>
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

    // الإحصائيات العلوي
    const todayStr = new Date().toLocaleDateString();
    const stats = {
        today: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === todayStr).length,
        total: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length,
        review: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length
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

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const getBtns = (row) => {
        const isSuper = currentAdminEmail === SUPER_ADMIN_EMAIL;
        const isMe = row.processed_by === currentAdminName;
        const isFree = !row.processed_by || row.processed_by === "" || row.processed_by === "--";

        let btns = `<a href="${row.file_url}" target="_blank" class="flex-1 bg-blue-600/20 text-blue-400 py-3 rounded-xl text-center text-[10px] font-black border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;

        if (isFree || isSuper) {
            if (row.status === 'pending') btns += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="flex-[2] bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black shadow-lg shadow-amber-900/40">حجز للمراجعة ✋</button>`;
        }
        if (isMe || isSuper) {
            if (row.status === 'reviewing') {
                btns += `<button onclick="updateStatus(${row.id}, 'approved')" class="flex-[2] bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-900/40">نشر الملف ✅</button>`;
                btns += `<button onclick="release(${row.id})" class="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-[10px]">إلغاء</button>`;
            } else if (row.status === 'approved') {
                btns += `<button onclick="updateStatus(${row.id}, 'pending')" class="flex-[2] bg-red-500/10 text-red-500 py-3 rounded-xl text-[10px] font-black">سحب النشر</button>`;
            }
        } else if (!isFree && !isMe) {
            btns = `<div class="w-full text-center py-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[10px] text-slate-500 italic">🔒 الملف محجوز لـ ${row.processed_by}</div>`;
        }
        return btns;
    };

    desktop.innerHTML = filtered.map(row => `
        <tr class="archive-item ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-40' : ''}">
            <td class="p-4 rounded-r-2xl border-y border-r border-slate-800">
                <div class="font-black text-white text-sm">${row.subject}</div>
                <div class="text-[10px] text-amber-500 mt-1 italic font-bold">📌 الطالب: ${row.description || 'بدون وصف'}</div>
            </td>
            <td class="p-4 border-y border-slate-800">
                <textarea onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px] bg-black/40 border border-slate-800 rounded-xl focus:border-blue-500 transition-all">${row.admin_note || ''}</textarea>
            </td>
            <td class="p-4 border-y border-slate-800 text-center text-blue-400/50 font-black text-[10px] uppercase">${row.processed_by || '--'}</td>
            <td class="p-4 rounded-l-2xl border-y border-l border-slate-800 min-w-[220px]">
                <div class="flex gap-2">${getBtns(row)}</div>
            </td>
        </tr>
    `).join("");

    mobile.innerHTML = filtered.map(row => `
        <div class="archive-item p-5 rounded-[2.2rem] space-y-4 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-60 grayscale-[0.3]' : ''}">
            <div class="flex justify-between">
                <div class="space-y-1">
                    <span class="bg-blue-500/10 text-blue-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase">${row.status === 'pending' ? 'جديد' : row.status}</span>
                    <h3 class="font-black text-white text-lg leading-tight">${row.subject}</h3>
                </div>
                <div class="text-left font-black text-[10px] text-blue-400 opacity-60">${row.processed_by || 'متاح'}</div>
            </div>
            <div class="bg-amber-500/5 border-r-2 border-amber-500/30 p-3 rounded-xl italic text-[10px] text-amber-500 font-bold leading-relaxed">" ${row.description || 'بدون وصف من الطالب'} "</div>
            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-[12px] h-24 bg-black/40 border border-slate-800 rounded-2xl focus:border-blue-500 transition-all" placeholder="اكتب ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 pt-2">${getBtns(row)}</div>
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
