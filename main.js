// ================= FIREBASE IMPORTS =================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyCi4ldLdVtWAUKb0wyyds2HnbNujjIHmWQ",
  authDomain: "guildrallyloots.firebaseapp.com",
  projectId: "guildrallyloots",
  storageBucket: "guildrallyloots.firebasestorage.app",
  messagingSenderId: "116266984921",
  appId: "1:116266984921:web:90326a9fed2ee48f79a5c8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= HELPERS =================
function formatDateTime(timestamp) {
  if (!timestamp) return "(No date)";
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getSelectedWeek() {
  return document.getElementById("week-selector").value;
}

// ================= LOAD WEEKS =================
async function loadWeeks() {
  const weekSelector = document.getElementById("week-selector");
  const querySnapshot = await getDocs(collection(db, "weeks"));
  const weeks = [];

  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const start = data.startDate ? formatDateTime(data.startDate) : "(no date)";
    weeks.push({
      id: docSnap.id,
      label: start
    });
  });

  weekSelector.innerHTML = weeks.map(w =>
    `<option value="${w.id}">${w.label}</option>`
  ).join("");

  if (weeks.length > 0) {
    weekSelector.value = weeks[weeks.length - 1].id;
    await loadDashboard();
    await loadBossParticipants();
  }
}

// ================= DASHBOARD =================
async function loadDashboard() {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const container = document.getElementById("dashboard-content");

  if (!snap.exists()) {
    container.innerHTML = "<p class='text-gray-500'>No data for this week.</p>";
    return;
  }

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;

  const memberSnapshot = await getDocs(collection(db, "members"));
  const memberMap = {};
  memberSnapshot.forEach(docSnap => {
    memberMap[docSnap.id] = docSnap.data().name;
  });

  const counts = {};
  bosses.forEach(boss => {
    (boss.participants || []).forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });

  const totalParticipation = Object.values(counts).reduce((a, b) => a + b, 0);
  const goldPerParticipation = totalParticipation > 0 ? totalEarnings / totalParticipation : 0;

  container.innerHTML = Object.entries(counts).map(([id, count]) => {
    const name = memberMap[id] || "(Unknown Member)";
    const gold = (count * goldPerParticipation).toFixed(1);
    return `
      <div class="p-2 border-b flex justify-between">
        <span>${name}</span>
        <span>${count} runs (${gold} gold)</span>
      </div>
    `;
  }).join("") || "<p class='text-gray-500'>No participation yet.</p>";
}

// ================= BOSS PARTICIPANTS =================
async function loadBossParticipants() {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const container = document.getElementById("boss-participants-content");

  if (!snap.exists()) {
    container.innerHTML = "<p class='text-gray-500'>No bosses recorded this week.</p>";
    return;
  }

  const weekData = snap.data();
  const bosses = weekData.bosses || [];

  const memberSnapshot = await getDocs(collection(db, "members"));
  const memberMap = {};
  memberSnapshot.forEach(docSnap => {
    memberMap[docSnap.id] = docSnap.data().name;
  });

  container.innerHTML = bosses.map((boss, i) => {
    const names = (boss.participants || []).map(id => memberMap[id] || "(Unknown)").join(", ");
    const date = boss.timestamp ? formatDateTime(boss.timestamp) : "(no date)";
    return `
      <div class="p-2 border-b">
        <div class="flex justify-between">
          <span><strong>${boss.name}</strong> — ${date}</span>
          <div>
            <button class="text-blue-600 underline mr-2" onclick="editBossParticipants(${i})">Edit</button>
            <button class="text-red-600 underline" onclick="deleteBossEntry(${i})">Delete</button>
          </div>
        </div>
        <div class="text-sm text-gray-700">Participants: ${names}</div>
      </div>
    `;
  }).join("") || "<p class='text-gray-500'>No boss entries yet.</p>";
}

// ================= ADD MEMBER =================
async function addMember() {
  const name = document.getElementById("new-member-name").value.trim();
  if (!name) return alert("Enter a member name.");

  const membersRef = collection(db, "members");
  const snap = await getDocs(membersRef);
  const existing = snap.docs.find(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (existing) return alert("Member already exists!");

  await addDoc(membersRef, { name });
  alert("✅ Member added!");
  document.getElementById("new-member-name").value = "";
  loadMembers();
}

// ================= ADD GLOBAL BOSS =================
async function addGlobalBoss() {
  const name = document.getElementById("new-boss-name").value.trim();
  if (!name) return alert("Enter boss name.");

  const bossesRef = collection(db, "bosses");
  const snap = await getDocs(bossesRef);
  const existing = snap.docs.find(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (existing) return alert("Boss already exists!");

  await addDoc(bossesRef, { name });
  alert("✅ Boss added!");
  document.getElementById("new-boss-name").value = "";
  loadBosses();
}

// ================= LOAD MEMBERS & BOSSES =================
async function loadMembers() {
  const memberList = document.getElementById("member-list");
  const snap = await getDocs(collection(db, "members"));
  memberList.innerHTML = snap.docs.map(docSnap => `
    <label class="flex items-center space-x-2">
      <input type="checkbox" value="${docSnap.id}" class="member-checkbox">
      <span>${docSnap.data().name}</span>
    </label>
  `).join("");
}

async function loadBosses() {
  const bossList = document.getElementById("boss-list");
  const snap = await getDocs(collection(db, "bosses"));
  bossList.innerHTML = snap.docs.map(docSnap => `
    <label class="flex items-center space-x-2">
      <input type="radio" name="selected-boss" value="${docSnap.data().name}">
      <span>${docSnap.data().name}</span>
    </label>
  `).join("");
}

// ================= ADD BOSS PARTICIPATION =================
async function addBossParticipation() {
  const weekId = getSelectedWeek();
  if (!weekId) return alert("Select a week first.");

  const selectedBoss = document.querySelector('input[name="selected-boss"]:checked');
  if (!selectedBoss) return alert("Select a boss.");
  const bossName = selectedBoss.value;

  const selectedMembers = [...document.querySelectorAll('.member-checkbox:checked')].map(el => el.value);
  if (selectedMembers.length === 0) return alert("Select at least one member.");

  const weekRef = doc(collection(db, "weeks"), weekId);
  const weekSnap = await getDoc(weekRef);

  const bossRecord = {
    name: bossName,
    participants: selectedMembers,
    timestamp: Date.now()
  };

  if (weekSnap.exists()) {
    const data = weekSnap.data();
    const bosses = data.bosses || [];
    bosses.push(bossRecord);
    await updateDoc(weekRef, { bosses });
  } else {
    await setDoc(weekRef, { bosses: [bossRecord] });
  }

  alert("✅ Boss participation added!");
  await loadDashboard();
  await loadBossParticipants();
}

// ================= DELETE WEEK =================
async function deleteSelectedWeek() {
  const weekId = getSelectedWeek();
  if (!weekId) return alert("No week selected.");
  if (!confirm("Are you sure you want to delete this week?")) return;

  const weekRef = doc(collection(db, "weeks"), weekId);
  await deleteDoc(weekRef);

  alert("✅ Week deleted!");
  await loadWeeks();
  loadDashboard();
  loadBossParticipants();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  await loadWeeks();
  await loadMembers();
  await loadBosses();

  document.getElementById("week-selector").addEventListener("change", () => {
    loadDashboard();
    loadBossParticipants();
  });

  document.getElementById("delete-week-btn").addEventListener("click", deleteSelectedWeek);
  document.getElementById("add-member-btn").addEventListener("click", addMember);
  document.getElementById("add-boss-btn").addEventListener("click", addGlobalBoss);
  document.getElementById("add-participation-btn").addEventListener("click", addBossParticipation);
});