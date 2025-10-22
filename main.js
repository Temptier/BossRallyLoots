import { db, collection, doc, setDoc, updateDoc, getDoc, arrayUnion, getDocs, deleteDoc } from './firebase.js';

let selectedMemberIds = new Set();
let selectedBossId = null;

// --- Week Helper ---
const getCurrentWeekId = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return `week-${monday.toISOString().slice(0,10)}`;
};

async function ensureCurrentWeek() {
  const weekId = getCurrentWeekId();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) {
    await setDoc(weekRef, {
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 6)),
      totalEarnings: 0,
      bosses: [],
      createdAt: new Date()
    });
  }
  return weekId;
}

// --- Members ---
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
    });
    container.appendChild(chip);
  });
}

document.getElementById("add-member").addEventListener("click", async () => {
  const name = document.getElementById("member-name").value.trim();
  if (!name) return alert("Enter a member name");

  const snapshot = await getDocs(collection(db, "members"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Member already exists!");

  const memberRef = doc(collection(db, "members"));
  await setDoc(memberRef, { name, createdAt: new Date() });
  document.getElementById("member-name").value = "";
  document.getElementById("member-name").focus();
  loadMembers();
});

// --- Global Bosses ---
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

document.getElementById("add-global-boss").addEventListener("click", async () => {
  const name = document.getElementById("boss-name-input").value.trim();
  if (!name) return alert("Enter boss name");

  const snapshot = await getDocs(collection(db,"bosses"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Boss already exists!");

  const bossRef = doc(collection(db,"bosses"));
  await setDoc(bossRef, { name, createdAt: new Date() });
  document.getElementById("boss-name-input").value = "";
  document.getElementById("boss-name-input").focus();
  loadGlobalBosses();
});

// --- Boss Chips for Weekly Participation (Floating) ---
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
      document.getElementById("open-boss-chips").textContent = docSnap.data().name; // show selected boss
      container.classList.add("hidden"); // hide floating chips after selection
    });

    container.appendChild(chip);
  });
}

// Toggle boss chips visibility
document.getElementById("open-boss-chips").addEventListener("click", () => {
  const container = document.getElementById("boss-chips");
  container.classList.toggle("hidden");
});

// --- Add Boss Participation ---
document.getElementById("add-boss").addEventListener("click", async () => {
  let bossName = null;

  if (selectedBossId) {
    const bossDoc = await getDoc(doc(collection(db,"bosses"), selectedBossId));
    bossName = bossDoc.data().name;
  }

  if (!bossName) return alert("Select a boss");
  if (selectedMemberIds.size === 0) return alert("Select participants");

  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);

  // Add a unique timestamp to allow duplicate boss+members
  await updateDoc(weekRef, {
    bosses: arrayUnion({
      name: bossName,
      participants: Array.from(selectedMemberIds),
      createdAt: new Date()
    })
  });

  selectedMemberIds.clear();
  selectedBossId = null;
  document.getElementById("open-boss-chips").textContent = "Select Boss";
  loadMembers();
  loadBossChips();
  loadDashboard();
});

// --- Update Total Earnings ---
document.getElementById("update-earnings").addEventListener("click", async () => {
  const earnings = Number(document.getElementById("total-earnings").value);
  if (isNaN(earnings)) return alert("Enter valid number");

  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db,"weeks"), weekId);
  await updateDoc(weekRef, { totalEarnings: earnings });
  loadDashboard();
});

// --- Load Dashboard (with boss details) ---
async function loadDashboard() {
  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db,"weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;

  // Count participation and track bosses
  const participationCount = {};
  bosses.forEach(b => b.participants.forEach(id => {
    if (!participationCount[id]) participationCount[id] = [];
    participationCount[id].push(b.name);
  }));

  // Calculate earnings
  const totalParticipations = Object.values(participationCount).reduce((sum, arr) => sum + arr.length, 0) || 1;
  const earnings = {};
  for (const [id, bossArray] of Object.entries(participationCount)) {
    earnings[id] = Math.floor((bossArray.length / totalParticipations) * totalEarnings);
  }

  // Render dashboard
  const dash = document.getElementById("dashboard-content");
  dash.innerHTML = "";

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
  const weekId = await ensureCurrentWeek();
  await deleteDoc(doc(collection(db,"weeks"), weekId));
  loadDashboard();
});

// --- Initial Load ---
loadMembers();
loadGlobalBosses();
loadBossChips();
loadDashboard();