import { db, collection, doc, setDoc, updateDoc, getDoc, arrayUnion, getDocs, deleteDoc } from './firebase.js';

// --- Variables ---
let selectedMemberIds = new Set();
let selectedBossId = null;

// --- Week Helper ---
const getCurrentWeekId = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // Monday
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

// --- Load Members as Chips ---
async function loadMembers() {
  const container = document.getElementById("member-chips");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "members"));
  snapshot.forEach(docSnap => {
    const chip = document.createElement("div");
    chip.textContent = docSnap.data().name;
    chip.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:bg-gray-300 text-black";
    chip.dataset.id = docSnap.id;

    chip.addEventListener("click", () => {
      if (selectedMemberIds.has(docSnap.id)) {
        selectedMemberIds.delete(docSnap.id);
        chip.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:bg-gray-300 text-black";
      } else {
        selectedMemberIds.add(docSnap.id);
        chip.className = "px-3 py-1 rounded-full bg-blue-500 text-white cursor-pointer";
      }
    });

    container.appendChild(chip);
  });
}

// --- Add Member with Duplicate Prevention ---
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

// --- Load Global Bosses ---
async function loadBosses() {
  const container = document.getElementById("boss-chips");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "bosses"));
  snapshot.forEach(docSnap => {
    const chip = document.createElement("div");
    chip.textContent = docSnap.data().name;
    chip.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:bg-gray-300 text-black";
    chip.dataset.id = docSnap.id;

    chip.addEventListener("click", () => {
      selectedBossId = docSnap.id;
      Array.from(container.children).forEach(c => c.className = "px-3 py-1 rounded-full bg-gray-200 cursor-pointer hover:bg-gray-300 text-black");
      chip.className = "px-3 py-1 rounded-full bg-green-500 text-white cursor-pointer";
    });

    container.appendChild(chip);
  });
}

// --- Add Boss to Global List ---
document.getElementById("add-global-boss").addEventListener("click", async () => {
  const name = document.getElementById("boss-name-input").value.trim();
  if (!name) return alert("Enter boss name");

  const snapshot = await getDocs(collection(db,"bosses"));
  const exists = snapshot.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Boss already exists!");

  const bossRef = doc(collection(db,"bosses"));
  await setDoc(bossRef, { name, createdAt: new Date() });
  document.getElementById("boss-name-input").value = "";
  loadBosses();
});

// --- Add Boss Participation ---
document.getElementById("add-boss").addEventListener("click", async () => {
  let bossName = document.getElementById("boss-name-inline").value.trim();

  // Use chip selection if no inline input
  if (!bossName && selectedBossId) {
    const bossDoc = await getDoc(doc(collection(db,"bosses"), selectedBossId));
    bossName = bossDoc.data().name;
  }

  if (!bossName) return alert("Enter or select a boss");
  if (selectedMemberIds.size === 0) return alert("Select participants");

  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);

  await updateDoc(weekRef, { bosses: arrayUnion({ name: bossName, participants: Array.from(selectedMemberIds) }) });

  selectedMemberIds.clear();
  selectedBossId = null;
  document.getElementById("boss-name-inline").value = "";
  loadMembers();
  loadBosses();
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

// --- Calculate Earnings ---
async function calculateEarnings(weekData) {
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;
  const participationCount = {};
  bosses.forEach(b => b.participants.forEach(id => participationCount[id] = (participationCount[id] || 0) + 1));
  const totalParticipations = Object.values(participationCount).reduce((a,b)=>a+b,0) || 1;

  const earnings = {};
  for (const [id,count] of Object.entries(participationCount)) earnings[id] = Math.floor((count/totalParticipations)*totalEarnings);
  return earnings;
}

// --- Load Dashboard ---
async function loadDashboard() {
  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db,"weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;
  const weekData = snap.data();
  const earnings = await calculateEarnings(weekData);

  const dash = document.getElementById("dashboard-content");
  dash.innerHTML = "";
  for (const [memberId, earning] of Object.entries(earnings)) {
    const memberDoc = await getDoc(doc(collection(db,"members"), memberId));
    const name = memberDoc.exists() ? memberDoc.data().name : "Unknown";
    const participations = weekData.bosses.filter(b => b.participants.includes(memberId)).length;
    const div = document.createElement("div");
    div.textContent = `${name} – Participations: ${participations} – Earnings: ${earning} gold`;
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
loadBosses();
loadDashboard();