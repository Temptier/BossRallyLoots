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

// --- Load Members into floating chip list ---
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

// Toggle member chips
document.getElementById("open-member-chips").addEventListener("click", () => {
  document.getElementById("member-chips").classList.toggle("hidden");
});

// --- Load Boss Chips for floating selector ---
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
      container.classList.add("hidden");
    });

    container.appendChild(chip);
  });
}

// Toggle boss chips
document.getElementById("open-boss-chips").addEventListener("click", () => {
  document.getElementById("boss-chips").classList.toggle("hidden");
});

// --- Add Boss Participation ---
document.getElementById("add-boss").addEventListener("click", async () => {
  if (!selectedBossId) return alert("Select a boss");
  if (selectedMemberIds.size === 0) return alert("Select participants");

  const bossDoc = await getDoc(doc(collection(db,"bosses"), selectedBossId));
  const bossName = bossDoc.data().name;

  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);

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

  const weekId = await ensureCurrentWeek();
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

// --- Dashboard ---
async function loadDashboard() {
  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db,"weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;

  const participationCount = {};
  bosses.forEach(b => b.participants.forEach(id => {
    if (!participationCount[id]) participationCount[id] = [];
    participationCount[id].push(b.name);
  }));

  const totalParticipations = Object.values(participationCount).reduce((sum, arr) => sum + arr.length, 0) || 1;
  const earnings = {};
  for (const [id, bossArray] of Object.entries(participationCount)) {
    earnings[id] = Math.floor((bossArray.length / totalParticipations) * totalEarnings);
  }

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