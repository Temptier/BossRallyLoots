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

// --- Rest of main.js stays same (add members, global bosses, dashboard, earnings, delete week) ---