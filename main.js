// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

// State
let selectedBossId = null;
let selectedMemberIds = new Set();

// Helpers
function getCurrentWeekId() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

function getSelectedWeek() {
  const selector = document.getElementById("week-selector");
  return selector?.value || getCurrentWeekId();
}

// Ensure week exists
async function ensureWeekExists(weekId) {
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) {
    const monday = new Date();
    monday.setDate(new Date().getDate() - new Date().getDay() + 1);
    const sunday = new Date(monday);
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

// 🟢 Load weeks with valid dates
async function loadWeeks() {
  const container = document.getElementById("week-selector");
  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "weeks"));
  const weeks = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aDate = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const bDate = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return bDate - aDate;
    });

  weeks.forEach(week => {
    const option = document.createElement("option");
    option.value = week.id;

    const start = week.startDate?.toDate ? week.startDate.toDate() : new Date(week.startDate);
    const end = week.endDate?.toDate ? week.endDate.toDate() : new Date(week.endDate);

    const startStr = !isNaN(start) ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";
    const endStr = !isNaN(end) ? end.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";

    option.textContent = `${startStr} - ${endStr}`;
    container.appendChild(option);
  });

  // Add current week if missing
  const currentWeekId = getCurrentWeekId();
  if (!weeks.some(w => w.id === currentWeekId)) {
    const monday = new Date();
    monday.setDate(new Date().getDate() - new Date().getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const option = document.createElement("option");
    option.value = currentWeekId;
    option.textContent = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    container.prepend(option);
  }

  // Select first week
  if (container.options.length > 0) container.selectedIndex = 0;
}

// 🟢 Load members
async function loadMembers() {
  const snapshot = await getDocs(collection(db, "members"));
  const list = document.getElementById("member-chips");
  list.innerHTML = "";
  snapshot.forEach(docSnap => {
    const member = docSnap.data();
    const chip = document.createElement("button");
    chip.textContent = member.name;
    chip.className = "border px-2 py-1 rounded m-1 text-sm hover:bg-gray-200";
    chip.onclick = () => {
      if (selectedMemberIds.has(docSnap.id)) {
        selectedMemberIds.delete(docSnap.id);
        chip.classList.remove("bg-green-300");
      } else {
        selectedMemberIds.add(docSnap.id);
        chip.classList.add("bg-green-300");
      }
    };
    list.appendChild(chip);
  });
}

// 🟢 Load bosses
async function loadBossChips() {
  const snapshot = await getDocs(collection(db, "bosses"));
  const list = document.getElementById("boss-chips");
  list.innerHTML = "";
  snapshot.forEach(docSnap => {
    const boss = docSnap.data();
    const chip = document.createElement("button");
    chip.textContent = boss.name;
    chip.className = "border px-2 py-1 rounded m-1 text-sm hover:bg-gray-200";
    chip.onclick = () => {
      selectedBossId = docSnap.id;
      document.getElementById("open-boss-chips").textContent = boss.name;
      document.getElementById("boss-float").classList.add("hidden");
    };
    list.appendChild(chip);
  });
}

// 🟢 Dashboard
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

  // Fetch all members to map IDs → names
  const memberSnapshot = await getDocs(collection(db, "members"));
  const memberMap = {};
  memberSnapshot.forEach(docSnap => {
    memberMap[docSnap.id] = docSnap.data().name;
  });

  // Count member participation
  const counts = {};
  bosses.forEach(b => {
    b.participants.forEach(p => {
      counts[p] = (counts[p] || 0) + 1;
    });
  });

  const totalParticipation = Object.values(counts).reduce((a, b) => a + b, 0);
  const goldPerParticipation = totalParticipation > 0 ? totalEarnings / totalParticipation : 0;

  // Display dashboard with real names
  container.innerHTML = Object.entries(counts).map(([id, count]) => {
    const name = memberMap[id] || "(Unknown Member)";
    return `
      <div class='p-2 border-b flex justify-between'>
        <span>${name}</span>
        <span>${count} runs (${(count * goldPerParticipation).toFixed(1)} gold)</span>
      </div>
    `;
  }).join("") || "<p class='text-gray-500'>No participation yet.</p>";
}

// 🟢 Add member
document.getElementById("add-member").addEventListener("click", async () => {
  const name = document.getElementById("member-name").value.trim();
  if (!name) return alert("Enter member name");

  const existing = await getDocs(collection(db, "members"));
  const exists = existing.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Member already exists!");

  await addDoc(collection(db, "members"), { name });
  document.getElementById("member-name").value = "";
  loadMembers();
});

// 🟢 Add boss
document.getElementById("add-boss-global").addEventListener("click", async () => {
  const name = document.getElementById("boss-name").value.trim();
  if (!name) return alert("Enter boss name");

  const existing = await getDocs(collection(db, "bosses"));
  const exists = existing.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (exists) return alert("Boss already exists!");

  await addDoc(collection(db, "bosses"), { name });
  document.getElementById("boss-name").value = "";
  loadBossChips();
});

// 🟢 Add participation
document.getElementById("add-boss").addEventListener("click", async () => {
  if (!selectedBossId) return alert("Select a boss");
  if (selectedMemberIds.size === 0) return alert("Select participants");

  const bossDoc = await getDoc(doc(collection(db, "bosses"), selectedBossId));
  const bossName = bossDoc.data().name;

  const weekId = getSelectedWeek();
  await ensureWeekExists(weekId);
  const weekRef = doc(collection(db, "weeks"), weekId);

  await updateDoc(weekRef, {
    bosses: arrayUnion({
      name: bossName,
      participants: Array.from(selectedMemberIds),
      createdAt: new Date()
    })
  });

  selectedBossId = null;
  selectedMemberIds.clear();
  document.getElementById("open-boss-chips").textContent = "Select Boss";
  document.getElementById("open-member-chips").textContent = "Select Members";

  loadDashboard();
});

// 🟢 Update earnings
document.getElementById("update-earnings").addEventListener("click", async () => {
  const earnings = Number(document.getElementById("total-earnings").value);
  if (isNaN(earnings)) return alert("Enter valid number");
  const weekId = getSelectedWeek();
  await ensureWeekExists(weekId);
  const weekRef = doc(collection(db, "weeks"), weekId);
  await updateDoc(weekRef, { totalEarnings: earnings });
  loadDashboard();
});

// 🟢 Floating chips toggle
document.getElementById("open-boss-chips").onclick = () => {
  document.getElementById("boss-float").classList.toggle("hidden");
};
document.getElementById("open-member-chips").onclick = () => {
  document.getElementById("member-float").classList.toggle("hidden");
};

// 🟢 Week selector auto-refresh
document.getElementById("week-selector").addEventListener("change", loadDashboard);

// Init
await loadWeeks();
await loadMembers();
await loadBossChips();
await loadDashboard();