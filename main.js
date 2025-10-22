import { db, collection, doc, setDoc, updateDoc, getDoc, getDocs, arrayUnion, deleteDoc } from './firebase.js';

let selectedMemberIds = new Set();
let selectedBossId = null;

// --- Current Week ---
const getCurrentWeekId = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return `week-${monday.toISOString().slice(0,10)}`;
};

// --- Ensure week exists ---
async function ensureWeekExists(weekId) {
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) {
    const monday = new Date();
    monday.setDate(new Date().getDate() - new Date().getDay() + 1);
    const sunday = new Date();
    sunday.setDate(monday.getDate() + 6);
    await setDoc(weekRef, {
      startDate: monday,
      endDate: sunday,
      totalEarnings: 0,
      bosses: [],
      createdAt: new Date()
    });
  }
}

// --- Load Weeks ---
async function loadWeeks() {
  const container = document.getElementById("week-selector");
  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "weeks"));
  const weeks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a,b) => new Date(b.startDate) - new Date(a.startDate));

  weeks.forEach(week => {
    const option = document.createElement("option");
    option.value = week.id;
    const start = new Date(week.startDate).toLocaleDateString();
    const end = new Date(week.endDate).toLocaleDateString();
    option.textContent = `${start} - ${end}`;
    container.appendChild(option);
  });

  const currentWeekId = getCurrentWeekId();
  if (!weeks.some(w => w.id === currentWeekId)) {
    const option = document.createElement("option");
    option.value = currentWeekId;
    const monday = new Date();
    monday.setDate(new Date().getDate() - new Date().getDay() + 1);
    const sunday = new Date();
    sunday.setDate(monday.getDate() + 6);
    option.textContent = `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
    container.prepend(option);
  }
}

// --- Selected Week ---
function getSelectedWeek() {
  const selector = document.getElementById("week-selector");
  return selector.value || getCurrentWeekId();
}

// --- Load Members ---
async function loadMembers() {
  const container = document.getElementById("member-chips");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "members"));
  snapshot.forEach(docSnap => {
    const chip = document.createElement("div");
    chip.textContent = docSnap.data().name;
    chip.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:scale-105 transition transform text-black";
    chip.dataset.id = docSnap.id;

    chip.addEventListener("click", () => {
      if (selectedMemberIds.has(docSnap.id)) {
        selectedMemberIds.delete(docSnap.id);
        chip.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:scale-105 transition transform text-black";
      } else {
        selectedMemberIds.add(docSnap.id);
        chip.className = "px-3 py-1 rounded-full bg-blue-500 text-white cursor-pointer hover:scale-105 transition transform";
      }
      const btn = document.getElementById("open-member-chips");
      btn.textContent = selectedMemberIds.size === 0 ? "Select Members" : `Selected: ${selectedMemberIds.size}`;
    });

    container.appendChild(chip);
  });
}

// --- Load Boss Chips ---
async function loadBossChips() {
  const container = document.getElementById("boss-chips");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "bosses"));
  snapshot.forEach(docSnap => {
    const chip = document.createElement("div");
    chip.textContent = docSnap.data().name;
    chip.className = "px-3 py-1 rounded-full bg-gray-200 text-black cursor-pointer hover:scale-105 transition transform";

    chip.addEventListener("click", () => {
      selectedBossId = docSnap.id;
      document.getElementById("open-boss-chips").textContent = docSnap.data().name;
      closePanels();
    });

    container.appendChild(chip);
  });
}

// --- Panels & Overlay ---
const bossPanel = document.getElementById("boss-chips-panel");
const memberPanel = document.getElementById("member-chips-panel");
const overlay = document.getElementById("overlay");

function openPanel(panel) {
  panel.classList.remove("translate-y-full");
  overlay.classList.add("visible"); // enable clicks
  overlay.classList.remove("hidden");
}

function closePanels() {
  bossPanel.classList.add("translate-y-full");
  memberPanel.classList.add("translate-y-full");
  overlay.classList.remove("visible"); // disable clicks
  overlay.classList.add("hidden");
}

document.getElementById("open-boss-chips").addEventListener("click", () => openPanel(bossPanel));
document.getElementById("open-member-chips").addEventListener("click", () => openPanel(memberPanel));
overlay.addEventListener("click", closePanels);

// --- Add Boss Participation ---
document.getElementById("add-boss").addEventListener("click", async () => {
  if (!selectedBossId) return alert("Select a boss");
  if (selectedMemberIds.size === 0) return alert("Select participants");

  const bossDoc = await getDoc(doc(collection(db,"bosses"), selectedBossId));
  const bossName = bossDoc.data().name;

  const weekId = getSelectedWeek();
  await ensureWeekExists(weekId);

  const weekRef = doc(collection(db, "weeks"), weekId);
  await updateDoc(weekRef, {
    bosses: arrayUnion({ name: bossName, participants: Array.from(selectedMemberIds), createdAt: new Date() })
  });

  selectedMemberIds.clear();
  selectedBossId = null;
  document.getElementById("open-boss-chips").textContent = "Select Boss";
  document.getElementById("open-member-chips").textContent = "Select Members";
  loadMembers();
  loadBossChips();
  loadDashboard();
});

// --- Add Member ---
document.getElementById("add-member").addEventListener("click", async () => {
  const name = document.getElementById("member-name").value.trim();
  if (!name) return alert("Enter a member name");

  const snapshot = await getDocs(collection(db, "members"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Member already exists!");

  const memberRef = doc(collection(db, "members"));
  await setDoc(memberRef, { name, createdAt: new Date() });
  document.getElementById("member-name").value = "";
  loadMembers();
});

// --- Add Global Boss ---
document.getElementById("add-global-boss").addEventListener("click", async () => {
  const name = document.getElementById("boss-name-input").value.trim();
  if (!name) return alert("Enter boss name");

  const snapshot = await getDocs(collection(db,"bosses"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Boss already exists!");

  const bossRef = doc(collection(db,"bosses"));
  await setDoc(bossRef, { name, createdAt: new Date() });
  document.getElementById("boss-name-input").value = "";
  loadGlobalBosses();
  loadBossChips();
});

// --- Update Total Earnings ---
document.getElementById("update-earnings").addEventListener("click", async () => {
  const earnings = Number(document.getElementById("total-earnings").value);
  if (isNaN(earnings)) return alert("Enter valid number");

  const weekId = getSelectedWeek();
  await ensureWeekExists(weekId);

  const weekRef = doc(collection(db,"weeks"), weekId);
  await updateDoc(weekRef, { totalEarnings: earnings });
  loadDashboard();
});

// --- Load Global Bosses ---
async function loadGlobalBosses() {
  const container = document.getElementById("boss-list-chips");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "bosses"));
  snapshot.forEach(docSnap => {
    const chip = document.createElement("div");
    chip.textContent = docSnap.data().name;
    chip.className = "px-3 py-1 rounded-full bg-purple-200 text-purple-800 cursor-pointer hover:scale-105 transition transform";
    container.appendChild(chip);
  });
}

// --- Load Dashboard ---
async function loadDashboard() {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db,"weeks"), weekId);
  const snap = await getDoc(weekRef);
  const dash = document.getElementById("dashboard-content");
  dash.innerHTML = "";

  if (!snap.exists()) {
    dash.innerHTML = "<p class='text-gray-500'>No data for this week.</p>";
    return;
  }

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;

  const participationCount = {};
  for (const b of bosses) {
    b.participants.forEach(id => {
      if (!participationCount[id]) participationCount[id] = [];
      participationCount[id].push(b.name);
    });
  }

  const totalParticipations = Object.values(participationCount).reduce((sum, arr) => sum + arr.length, 0) || 1;
  const earnings = {};
  for (const [id, bossArray] of Object.entries(participationCount)) {
    earnings[id] = Math.floor((bossArray.length / totalParticipations) * totalEarnings);
  }

  for (const [memberId, bossArray] of Object.entries(participationCount)) {
    const memberDoc = await getDoc(doc(collection(db,"members"), memberId));
    const name = memberDoc.exists() ? memberDoc.data().name : "Unknown";
    const participations = bossArray.length;
    const bossesJoined = bossArray.join(", ");

    const div = document.createElement("div");
    div.className = "p-2 bg-gray-100 rounded shadow mb-1";
    div.textContent = `${name} – Participations: ${participations} – Bosses: ${bossesJoined} – Earnings: ${earnings[memberId]} gold`;
    dash.appendChild(div);
  }
}

// --- Delete Week ---
document.getElementById("delete-week").addEventListener("click", async () => {
  if (!confirm("Delete current week?")) return;
  const weekId = getSelectedWeek();
  await deleteDoc(doc(collection(db,"weeks"), weekId));
  loadDashboard();
  loadWeeks();
});

// --- Update dashboard when week changes ---
document.getElementById("week-selector").addEventListener("change", () => {
  loadDashboard();
});

// --- Initial Load ---
await loadWeeks();
loadMembers();
loadGlobalBosses();
loadBossChips();
loadDashboard();