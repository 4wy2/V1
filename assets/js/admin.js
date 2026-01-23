const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



let allRows = [];

let currentFilter = "pending";

let currentAdminName = "";

let currentAdminUserId = "";

let isSuperAdmin = false;



// ================= AUTH =================

document.getElementById("loginForm").onsubmit = async (e) => {

    e.preventDefault();

    const btn = e.target.querySelector("button");

    btn.innerText = "جاري الدخول...";

    const { error } = await supa.auth.signInWithPassword({

        email: document.getElementById("email").value,

        password: document.getElementById("password").value

    });

    if (error) { alert("خطأ: " + error.message); btn.innerText = "دخول النظام"; }

    else checkUser();

};



async function checkUser() {

    const { data: { session } } = await supa.auth.getSession();

    if (!session) return;

    currentAdminUserId = session.user.id;

    document.getElementById("loginCard").classList.add("hidden");

    document.getElementById("adminPanel").classList.remove("hidden");



    const { data: admin } = await supa.from("admins").select("full_name,is_super").eq("user_id", currentAdminUserId).maybeSingle();

    currentAdminName = admin?.full_name || session.user.email.split("@")[0];

    isSuperAdmin = !!admin?.is_super;



    document.getElementById("whoami").innerHTML = `

        <div class="flex flex-col">

            <span class="text-blue-400 text-[10px] font-black uppercase tracking-tighter">المشرف المسؤول</span>

            <span class="text-white font-black text-lg">${currentAdminName} ${isSuperAdmin ? '👑' : ''}</span>

        </div>

    `;

    loadData();

}



// ================= DATA & RENDER =================

async function loadData() {

    const { data } = await supa.from("resources").select("*").order("created_at", { ascending: false });

    allRows = data || [];

    render();

}



function render() {

    const desktop = document.getElementById("desktopList");

    const mobile = document.getElementById("mobileList");

    const search = (document.getElementById("searchBox").value || "").toLowerCase();



    // إحصائيات الإنجاز

    const stats = {

        today: allRows.filter(r => r.processed_by_user_id === currentAdminUserId && r.status === "approved").length,

        review: allRows.filter(r => r.processed_by_user_id === currentAdminUserId && r.status === "reviewing").length

    };

    document.getElementById("productivityStats").innerHTML = `

        <div class="flex justify-around items-center h-full text-white">

            <div class="text-center"><p class="text-[9px] text-blue-400 font-bold uppercase">إنجازك</p><p class="text-xl font-black">${stats.today}</p></div>

            <div class="w-px h-8 bg-slate-700"></div>

            <div class="text-center"><p class="text-[9px] text-amber-500 font-bold uppercase">تحت المراجعة</p><p class="text-xl font-black">${stats.review}</p></div>

        </div>

    `;



    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && (r.subject || "").toLowerCase().includes(search));



    const getActionBtns = (row) => {

        const isMe = row.processed_by_user_id === currentAdminUserId;

        const isFree = !row.processed_by_user_id;

        let btns = `<a href="${row.file_url}" target="_blank" class="flex-1 bg-blue-600/20 text-blue-400 py-3 rounded-xl text-center text-[10px] font-black border border-blue-600/20 shadow-sm transition-all hover:bg-blue-600 hover:text-white">فتح</a>`;



        if ((isFree || isSuperAdmin) && row.status === "pending") {

            btns += `<button onclick="claim(${row.id})" class="flex-[2] bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black shadow-lg shadow-amber-900/20">حجز للمراجعة</button>`;

        }

        if (isMe || isSuperAdmin) {

            if (row.status === "reviewing") {

                btns += `<button onclick="updateStatus(${row.id}, 'approved')" class="flex-[2] bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-900/20 text-center">اعتماد ✅</button>`;

                btns += `<button onclick="release(${row.id})" class="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-[10px] font-bold">إلغاء</button>`;

            } else if (row.status === "approved") {

                btns += `<button onclick="updateStatus(${row.id}, 'pending')" class="flex-[2] bg-red-500/10 text-red-500 py-3 rounded-xl text-[10px] font-black border border-red-500/10">سحب النشر</button>`;

            }

        } else if (!isFree && !isMe) {

            btns = `<div class="w-full text-center py-3 bg-slate-900/50 rounded-xl text-[10px] text-slate-500 italic border border-slate-800">🔒 محجوز لـ ${row.processed_by_name || 'مشرف آخر'}</div>`;

        }

        return btns;

    };



    desktop.innerHTML = filtered.map(row => `

        <tr class="archive-item ${row.processed_by_user_id && row.processed_by_user_id !== currentAdminUserId && !isSuperAdmin ? "opacity-40" : ""}">

            <td class="p-4 rounded-r-2xl border-y border-r border-slate-800"><div class="font-black text-white text-sm">${row.subject || "--"}</div></td>

            <td class="p-4 border-y border-slate-800"><textarea onchange="updateNote(${row.id}, this.value)" class="w-full h-12 p-3 text-[11px] bg-black/40 border border-slate-800 rounded-xl outline-none focus:border-blue-500 transition-all">${row.admin_note || ""}</textarea></td>

            <td class="p-4 border-y border-slate-800 text-center text-blue-400/50 font-black text-[10px]">${row.processed_by_name || "--"}</td>

            <td class="p-4 rounded-l-2xl border-y border-l border-slate-800 min-w-[220px]"><div class="flex gap-2">${getActionBtns(row)}</div></td>

        </tr>

    `).join("");



    mobile.innerHTML = filtered.map(row => `

        <div class="archive-item p-5 rounded-[2.5rem] space-y-4 border border-slate-800 relative shadow-2xl">

            <div class="flex justify-between items-start">

                <div class="flex flex-col"><span class="text-[9px] text-blue-500 font-black uppercase mb-1">${row.status}</span><h3 class="font-black text-white text-lg leading-tight">${row.subject || "--"}</h3></div>

                <div class="bg-blue-500/10 px-3 py-1 rounded-full text-[9px] text-blue-400 font-bold">${row.processed_by_name || 'متاح'}</div>

            </div>

            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-[12px] h-24 bg-black/40 border border-slate-800 rounded-[1.5rem] focus:border-blue-500 outline-none" placeholder="ملاحظة المراجعة...">${row.admin_note || ""}</textarea>

            <div class="flex gap-2 pt-2">${getActionBtns(row)}</div>

        </div>

    `).join("");

    document.getElementById("totalCount").textContent = allRows.length;

}



// ================= ACTIONS =================

window.claim = async (id) => {

    const { error } = await supa.from("resources").update({ 

        status: 'reviewing', 

        processed_by_user_id: currentAdminUserId, 

        processed_by_name: currentAdminName 

    }).eq("id", id);

    if (error) alert("فشل الحجز: تأكد من وجود كولوم processed_by_user_id");

    else loadData();

};



window.updateStatus = async (id, s) => {

    await supa.from("resources").update({ status: s, updated_at: new Date().toISOString() }).eq("id", id);

    loadData();

};



window.updateNote = async (id, n) => {

    await supa.from("resources").update({ admin_note: n }).eq("id", id);

};



window.release = async (id) => {

    await supa.from("resources").update({ processed_by_user_id: null, processed_by_name: null, status: "pending" }).eq("id", id);

    loadData();

};



document.querySelectorAll(".filterBtn").forEach(b => b.onclick = () => {

    currentFilter = b.dataset.filter;

    document.querySelectorAll(".filterBtn").forEach(x => x.classList.remove("bg-blue-600", "text-white"));

    b.classList.add("bg-blue-600", "text-white");

    render();

});



checkUser();
