// admin.js - النسخة الاحترافية V2
const SUPABASE_URL = "https://zakzkcxyxntvlsvywmii.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3prY3h5eG50dmxzdnl3bWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODY1NDIsImV4cCI6MjA4NDY2MjU0Mn0.hApvnHyFsm5SBPUWdJ0AHrjMmxYrihXhEq9P_Knp-vY";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRows = [];
let currentFilter = 'pending';

// --- وظائف التحكم في البيانات ---

// 1. تغيير حالة الملف (أهم وظيفة سألت عنها)
async function updateStatus(id, newStatus) {
    const { error } = await supa
        .from("resources")
        .update({ status: newStatus })
        .eq("id", id);

    if (error) {
        alert("فشل التحديث: " + error.message);
    } else {
        console.log(`Updated ${id} to ${newStatus}`);
        await loadResources(); // تحديث القائمة فوراً
    }
}

// 2. جلب البيانات من السيرفر
async function loadResources() {
    const { data, error } = await supa
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        alert("خطأ في جلب البيانات: " + error.message);
        return;
    }

    allRows = data;
    renderAll();
}

// 3. عرض البيانات في الصفحة بشكل جميل
function renderAll() {
    const list = document.getElementById("listBox");
    const search = document.getElementById("searchBox").value.toLowerCase();
    
    // تصفية البيانات
    const filtered = allRows.filter(r => {
        const matchesTab = currentFilter === 'all' || r.status === currentFilter;
        const matchesSearch = r.subject?.toLowerCase().includes(search);
        return matchesTab && matchesSearch;
    });

    // تحديث العدادات
    document.getElementById("countBadge").textContent = filtered.length;

    if (filtered.length === 0) {
        list.innerHTML = `<div class="py-20 text-center opacity-30">لا توجد ملفات حالياً</div>`;
        return;
    }

    list.innerHTML = filtered.map(row => `
        <div class="glass p-5 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 border border-white/5 hover:border-white/20 transition-all">
            <div class="text-right">
                <span class="text-[10px] uppercase tracking-widest opacity-40 font-bold">${row.id}</span>
                <h3 class="font-black text-lg text-white/90">${row.subject}</h3>
                <p class="text-sm text-white/50">${row.note || 'لا توجد ملاحظات'}</p>
                <div class="mt-2 flex gap-2 items-center">
                    <span class="status-pill ${row.status}">${row.status}</span>
                    <span class="text-[10px] opacity-30">${new Date(row.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
            </div>
            
            <div class="flex flex-wrap gap-2">
                <a href="${row.file_url}" target="_blank" class="btn-action bg-white/5 text-white">معاينة</a>
                
                ${row.status !== 'approved' ? 
                    `<button onclick="updateStatus(${row.id}, 'approved')" class="btn-action bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">اعتماد ✅</button>` : ''}
                
                ${row.status !== 'pending' ? 
                    `<button onclick="updateStatus(${row.id}, 'pending')" class="btn-action bg-amber-500/20 text-amber-400 border border-amber-500/30">تعليق ⏳</button>` : ''}
                
                <button onclick="deleteRow(${row.id})" class="btn-action bg-red-500/20 text-red-400 border border-red-500/30">حذف 🗑️</button>
            </div>
        </div>
    `).join("");
}

// 4. حذف ملف
async function deleteRow(id) {
    if (!confirm("هل أنت متأكد من حذف هذا الملف نهائياً؟")) return;
    const { error } = await supa.from("resources").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadResources();
}

// جعل الوظائف متاحة في الـ HTML
window.updateStatus = updateStatus;
window.deleteRow = deleteRow;

// --- عند التحميل ---
document.addEventListener("DOMContentLoaded", () => {
    // ربط الفلاتر
    document.querySelectorAll(".filterBtn").forEach(btn => {
        btn.onclick = () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderAll();
        };
    });

    document.getElementById("searchBox").oninput = renderAll;
    
    // التحقق من الجلسة
    supa.auth.getUser().then(({data}) => {
        if (data.user) loadResources();
        else window.location.href = "login.html"; // افترضنا وجود صفحة دخول
    });
});
