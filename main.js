// =============================
// Firebase Configuration
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCi4ldLdVtWAUKb0wyyds2HnbNujjIHmWQ",
  authDomain: "guildrallyloots.firebaseapp.com",
  projectId: "guildrallyloots",
  storageBucket: "guildrallyloots.firebasestorage.app",
  messagingSenderId: "116266984921",
  appId: "1:116266984921:web:90326a9fed2ee48f79a5c8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================
// Helper Functions
// =============================
function getWeekRange(date = new Date()) {
  const monday = new Date(date);
  monday.setDate(date.getDate() - date.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================
// UI Elements
// =============================
const weekSelector = document.getElementById("week-selector");
const dashboardContent = document.getElementById("dashboard-content");
const bossParticipantsContent = document.getElementById("boss-participants-content");
const bossListDiv = document.getElementById("boss-list");
const memberListDiv = document.getElementById("member-list");
const addParticipationBtn = document.getElementById("add-participation-btn");
const deleteWeekBtn = document.getElementById("delete-week-btn");
const newBossInput = document.getElementById("new-boss-name");
const addBossBtn = document.getElementById("add-boss-btn");
const newMemberInput = document.getElementById("new-member-name");
const addMemberBtn = document.getElementById("add-member-btn");
const weeklyEarningsInput = document.getElementById("weekly-earnings");
const saveEarningsBtn = document.getElementById("save-earnings-btn");

let currentWeekId = null;

// =============================
// Week Functions
// =============================
async function loadWeeks() {
  const weeksRef = collection(db, "weeks");
  const snapshot = await getDocs(weeksRef);
  weekSelector.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = `${new Date(data.start).toLocaleDateString()} - ${new Date(
      data.end
    ).toLocaleDateString()}`;
    weekSelector.appendChild(option);
  });

  if (snapshot.empty) {
    await createCurrentWeek();
  } else {
    weekSelector.value = snapshot.docs[0].id;
    currentWeekId = snapshot.docs[0].id;
    loadDashboard();
    loadBossParticipants();
  }
}

async function createCurrentWeek() {
  const { monday, sunday } = getWeekRange();
  const weeksRef = collection(db, "weeks");
  const newWeek = await addDoc(weeksRef, {
    start: monday.toISOString(),
    end: sunday.toISOString(),
    totalEarnings: 0,
  });
  await loadWeeks();
  weekSelector.value = newWeek.id;
  currentWeekId = newWeek.id;
}

weekSelector.addEventListener("change", () => {
  currentWeekId = weekSelector.value;
  loadDashboard();
  loadBossParticipants();
  loadWeekEarnings();
});

deleteWeekBtn.addEventListener("click", async () => {
  if (currentWeekId && confirm("Delete this week and all records?")) {
    await deleteDoc(doc(db, "weeks", currentWeekId));
    await loadWeeks();
  }
});

// =============================
// Weekly Earnings
// =============================
async function loadWeekEarnings() {
  if (!currentWeekId) return;
  const docSnap = await getDoc(doc(db, "weeks", currentWeekId));
  if (docSnap.exists()) {
    weeklyEarningsInput.value = docSnap.data().totalEarnings || 0;
  }
}

saveEarningsBtn.addEventListener("click", async () => {
  if (!currentWeekId) return;
  const amount = parseFloat(weeklyEarningsInput.value) || 0;
  await updateDoc(doc(db, "weeks", currentWeekId), { totalEarnings: amount });
  loadDashboard();
});

// =============================
// Bosses and Members
// =============================
async function loadBosses() {
  bossListDiv.innerHTML = "";
  const bossesRef = collection(db, "bosses");
  const snapshot = await getDocs(bossesRef);
  snapshot.forEach((docSnap) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label class="flex items-center gap-2">
        <input type="radio" name="selected-boss" value="${docSnap.id}" />
        ${docSnap.data().name}
      </label>`;
    bossListDiv.appendChild(div);
  });
}

async function loadMembers() {
  memberListDiv.innerHTML = "";
  const membersRef = collection(db, "members");
  const snapshot = await getDocs(membersRef);
  snapshot.forEach((docSnap) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label class="flex items-center gap-2">
        <input type="checkbox" name="selected-member" value="${docSnap.id}" />
        ${docSnap.data().name}
      </label>`;
    memberListDiv.appendChild(div);
  });
}

addBossBtn.addEventListener("click", async () => {
  const name = newBossInput.value.trim();
  if (!name) return;
  const bossesRef = collection(db, "bosses");
  const snapshot = await getDocs(query(bossesRef, where("name", "==", name)));
  if (snapshot.empty) {
    await addDoc(bossesRef, { name });
    newBossInput.value = "";
    loadBosses();
  } else {
    alert("Boss already exists!");
  }
});

addMemberBtn.addEventListener("click", async () => {
  const name = newMemberInput.value.trim();
  if (!name) return;
  const membersRef = collection(db, "members");
  const snapshot = await getDocs(query(membersRef, where("name", "==", name)));
  if (snapshot.empty) {
    await addDoc(membersRef, { name });
    newMemberInput.value = "";
    loadMembers();
  } else {
    alert("Member already exists!");
  }
});

// =============================
// Add Participation
// =============================
addParticipationBtn.addEventListener("click", async () => {
  if (!currentWeekId) return;

  const selectedBoss = document.querySelector('input[name="selected-boss"]:checked');
  if (!selectedBoss) return alert("Select a boss first.");

  const selectedMembers = Array.from(
    document.querySelectorAll('input[name="selected-member"]:checked')
  ).map((m) => m.value);
  if (selectedMembers.length === 0) return alert("Select at least one member.");

  await addDoc(collection(db, "weeks", currentWeekId, "participations"), {
    bossId: selectedBoss.value,
    members: selectedMembers,
    timestamp: new Date().toISOString(),
  });

  loadDashboard();
  loadBossParticipants();
});

// =============================
// Load Dashboard and Participants
// =============================
async function loadDashboard() {
  if (!currentWeekId) return;
  const weekDoc = await getDoc(doc(db, "weeks", currentWeekId));
  const totalEarnings = weekDoc.exists() ? weekDoc.data().totalEarnings || 0 : 0;

  const partRef = collection(db, "weeks", currentWeekId, "participations");
  const snapshot = await getDocs(partRef);

  const memberCount = {};
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    data.members.forEach((m) => {
      memberCount[m] = (memberCount[m] || 0) + 1;
    });
  }

  const membersRef = collection(db, "members");
  const membersSnapshot = await getDocs(membersRef);
  const memberMap = {};
  membersSnapshot.forEach((m) => (memberMap[m.id] = m.data().name));

  const totalParticipations = Object.values(memberCount).reduce((a, b) => a + b, 0);
  dashboardContent.innerHTML = Object.entries(memberCount)
    .map(([id, count]) => {
      const share = totalParticipations ? ((count / totalParticipations) * totalEarnings).toFixed(2) : "0";
      return `<div class="flex justify-between border-b py-1">
        <span>${memberMap[id] || "Unknown"}</span>
        <span>${count} runs (${share}g)</span>
      </div>`;
    })
    .join("");
}

async function loadBossParticipants() {
  if (!currentWeekId) return;
  const partRef = collection(db, "weeks", currentWeekId, "participations");
  const snapshot = await getDocs(partRef);

  const bossesRef = collection(db, "bosses");
  const bossesSnap = await getDocs(bossesRef);
  const bossMap = {};
  bossesSnap.forEach((b) => (bossMap[b.id] = b.data().name));

  const membersRef = collection(db, "members");
  const membersSnap = await getDocs(membersRef);
  const memberMap = {};
  membersSnap.forEach((m) => (memberMap[m.id] = m.data().name));

  bossParticipantsContent.innerHTML = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const bossName = bossMap[data.bossId] || "Unknown Boss";
      const time = formatDateTime(new Date(data.timestamp));
      const names = data.members.map((id) => memberMap[id] || "Unknown").join(", ");
      return `<div class="border-b py-1 flex justify-between">
        <span>${bossName} - ${time}</span>
        <span>${names}</span>
      </div>`;
    })
    .join("");
}

// =============================
// Initialize
// =============================
loadWeeks();
loadBosses();
loadMembers();