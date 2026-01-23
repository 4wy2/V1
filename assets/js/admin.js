const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPER_ADMIN_EMAIL = "mohammed.rasasi@gmail.com"; // غيره لإيميلك الفعلي

let allRows = [];
let currentFilter = "pending";
let currentAdminName = "";
let currentAdminEmail = "";

// دالة الدخول المباشرة (استبدلناها بحدث مباشر على الفورم)
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const loginBtn = e.target.querySelector('button');

    loginBtn.innerText = "جاري التحقق...";
    loginBtn.disabled = true;

    try {
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        console.log("تم الدخول بنجاح!");
        checkUser(); // الانتقال للوحة التحكم
    } catch (error) {
        alert("خطأ: " + error.message);
        loginBtn.innerText = "دخول النظام";
        loginBtn.disabled = false;
    }
}

// ربط الفورم بالدالة
document.getElementById("loginForm").onsubmit = handleLogin;

async function checkUser() {
    const { data: { session } } = await supa.auth.getSession();
    
    if (session) {
        currentAdminEmail = session.user.email;
        document.getElementById("loginCard").classList.add("hidden");
        document.getElementById("adminPanel").classList.remove("hidden");
        
        // جلب الاسم من جدول المشرفين
        const { data: admin } = await supa.from("admins").select("full_name").eq("user_id", session.user.id).maybeSingle();
        currentAdminName = admin?.full_name || currentAdminEmail.split('@')[0];
        
        document.getElementById("whoami").innerHTML = `
            <span class="text-blue-400 text-[10px] block font-black uppercase tracking-widest">
                ${currentAdminEmail === SUPER_ADMIN_EMAIL ? 'المدير العام' : 'المشرف المسؤول'}
            </span>
            <span class="text-white font-black text-xl">${currentAdminName}</span>
        `;
        
        loadData();
    }
}

async function loadData() {
    const { data, error } = await supa.from("resources").select("*").order("created_at", { ascending: false });
    if (error) console.error("خطأ جلب البيانات:", error);
    allRows = data || [];
    render();
}

function render() {
    const desktop = document.getElementById("desktopList");
    const mobile = document.getElementById("mobileList");
    const search = document.getElementById("searchBox").value.toLowerCase();

    // تحديث الإحصائيات العلوي
    const todayStr = new Date().toLocaleDateString();
    const stats = {
        today: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved' && new Date(r.updated_at).toLocaleDateString() === todayStr).length,
        total: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'approved').length,
        review: allRows.filter(r => r.processed_by === currentAdminName && r.status === 'reviewing').length
    };

    document.getElementById("productivityStats").innerHTML = `
        <div class="flex justify-around items-center h-full">
            <div class="text-center"><p class="text-[9px] text-blue-400 font-bold mb-1">إنجازك اليوم</p><p class="text-2xl font-black text-white leading-none">${stats.today}</p></div>
            <div class="w-px h-10 bg-slate-700"></div>
            <div class="text-center"><p class="text-[9px] text-amber-500 font-bold mb-1">قيد المراجعة</p><p class="text-2xl font-black text-white leading-none">${stats.review}</p></div>
            <div class="w-px h-10 bg-slate-700"></div>
            <div class="text-center"><p class="text-[9px] text-emerald-400 font-bold mb-1">إجمالي بصمتك</p><p class="text-2xl font-black text-white leading-none">${stats.total}</p></div>
        </div>
    `;

    const filtered = allRows.filter(r => (currentFilter === "all" || r.status === currentFilter) && r.subject.toLowerCase().includes(search));

    const getBtns = (row) => {
        const isSuper = currentAdminEmail === SUPER_ADMIN_EMAIL;
        const isMe = row.processed_by === currentAdminName;
        const isFree = !row.processed_by || row.processed_by === "" || row.processed_by === "--";

        let h = `<a href="${row.file_url}" target="_blank" class="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">فتح</a>`;

        if (isFree || isSuper) {
            if (row.status === 'pending') h += `<button onclick="updateStatus(${row.id}, 'reviewing')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">حجز</button>`;
        }

        if (isMe || isSuper) {
            if (row.status === 'reviewing') {
                h += `<button onclick="updateStatus(${row.id}, 'approved')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md">اعتماد ✅</button>`;
                h += `<button onclick="release(${row.id})" class="text-slate-500 text-[10px] border border-slate-800 px-2 py-2 rounded-lg">إلغاء</button>`;
            } else if (row.status === 'approved') {
                h += `<button onclick="updateStatus(${row.id}, 'pending')" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black">سحب</button>`;
            }
        } else if (!isFree && !isMe) {
            h += `<span class="text-[9px] text-slate-500 italic bg-slate-900 px-3 py-2 rounded-xl">🔒 مع ${row.processed_by}</span>`;
        }
        return h;
    };

    desktop.innerHTML = filtered.map(row => `
        <tr class="archive-item border-b border-slate-800/30 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-40' : ''}">
            <td class="p-4"><div class="font-black text-white text-xs">${row.subject}</div><div class="text-[9px] text-amber-500 mt-1 italic">📌 ${row.description || 'بدون وصف'}</div></td>
            <td class="p-4"><textarea onchange="updateNote(${row.id}, this.value)" class="w-full h-10 p-2 text-[10px] bg-black/20 border border-slate-800 rounded-lg text-slate-300" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea></td>
            <td class="p-4 text-center text-[10px] text-slate-500 font-bold">${row.processed_by || '--'}</td>
            <td class="p-4"><div class="flex gap-2 justify-end">${getBtns(row)}</div></td>
        </tr>
    `).join("");

    mobile.innerHTML = filtered.map(row => `
        <div class="archive-item p-6 rounded-[2.5rem] space-y-4 ${row.processed_by && row.processed_by !== currentAdminName ? 'opacity-50' : ''}">
            <div class="flex justify-between items-center"><span class="font-black text-white text-sm">${row.subject}</span><span class="text-[9px] text-blue-500 font-bold">${row.processed_by || 'متاح'}</span></div>
            <textarea onchange="updateNote(${row.id}, this.value)" class="w-full p-4 text-[10px] h-20 bg-black/40 rounded-2xl" placeholder="ملاحظة اللجنة...">${row.admin_note || ''}</textarea>
            <div class="flex gap-2 flex-wrap pt-2">${getBtns(row)}</div>
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

// تشغيل الفحص عند تحميل الصفحة
checkUser();
