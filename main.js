import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// =============================
// Firebase Config
// =============================
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

// =============================
// DOM Elements
// =============================
const weekSelect = document.getElementById("weekSelect");
const bossSelect = document.getElementById("bossSelect");
const memberListDiv = document.getElementById("memberList");
const participationList = document.getElementById("participationList");
const addParticipationBtn = document.getElementById("addParticipationBtn");
const addBossBtn = document.getElementById("addBossBtn");
const addMemberBtn = document.getElementById("addMemberBtn");
const dashboardDiv = document.getElementById("dashboard");

// =============================
// Helper: Format Date
// =============================
function formatDate(date) {
  const options = { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  return date.toLocaleString("en-US", options).replace(",", "");
}

// =============================
// Auto-create current week if missing
// =============================
async function ensureCurrentWeek() {
  const now = new Date();
  const weekId = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
  const weekRef = doc(db, "weeks", weekId);
  const weekSnap = await getDoc(weekRef);

  if (!weekSnap.exists()) {
    await setDoc(weekRef, {
      week: weekId,
      startDate: new Date().toISOString(),
    });
  }
  return weekId;
}

// =============================
// Load Week Options
// =============================
async function loadWeeks() {
  const weeksRef = collection(db, "weeks");
  const snapshot = await getDocs(weeksRef);

  weekSelect.innerHTML = "";
  const currentWeekId = await ensureCurrentWeek();

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const option = document.createElement("option");
    const date = new Date(data.startDate);
    option.value = docSnap.id;
    option.textContent = `${docSnap.id} (${formatDate(date)})`;
    if (docSnap.id === currentWeekId) option.selected = true;
    weekSelect.appendChild(option);
  });

  return currentWeekId;
}

// =============================
// Load Bosses
// =============================
async function loadBosses() {
  const bossesRef = collection(db, "bosses");
  const snapshot = await getDocs(bossesRef);
  bossSelect.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = docSnap.data().name;
    bossSelect.appendChild(option);
  });
}

// =============================
// Load Members (Alphabetical + Deselect All)
// =============================
async function loadMembers() {
  memberListDiv.innerHTML = "";

  const membersRef = collection(db, "members");
  const snapshot = await getDocs(membersRef);

  const sorted = snapshot.docs.sort((a, b) =>
    a.data().name.localeCompare(b.data().name)
  );

  // Add Deselect All button
  const deselectBtn = document.createElement("button");
  deselectBtn.textContent = "Deselect All";
  deselectBtn.className =
    "bg-gray-300 text-sm px-2 py-1 rounded mb-2 hover:bg-gray-400";
  deselectBtn.addEventListener("click", () => {
    const checkboxes = memberListDiv.querySelectorAll(
      'input[name="selected-member"]'
    );
    checkboxes.forEach((cb) => (cb.checked = false));
  });
  memberListDiv.appendChild(deselectBtn);

  sorted.forEach((docSnap) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label class="flex items-center gap-2">
        <input type="checkbox" name="selected-member" value="${docSnap.id}" />
        ${docSnap.data().name}
      </label>`;
    memberListDiv.appendChild(div);
  });
}

// =============================
// Add Boss Participation
// =============================
addParticipationBtn.addEventListener("click", async () => {
  const bossId = bossSelect.value;
  const weekId = weekSelect.value;
  const selectedMembers = Array.from(
    document.querySelectorAll('input[name="selected-member"]:checked')
  ).map((i) => i.value);

  if (!bossId || !weekId || selectedMembers.length === 0) {
    alert("Please select boss, week, and members.");
    return;
  }

  const participationRef = collection(db, "weeks", weekId, "participations");
  await addDoc(participationRef, {
    bossId,
    members: selectedMembers,
    timestamp: new Date().toISOString(),
  });

  loadBossParticipants();
  loadDashboard();
});

// =============================
// Add Boss
// =============================
addBossBtn.addEventListener("click", async () => {
  const bossName = prompt("Enter Boss Name:");
  if (!bossName) return;
  const bossesRef = collection(db, "bosses");
  await addDoc(bossesRef, { name: bossName });
  loadBosses();
});

// =============================
// Add Member
// =============================
addMemberBtn.addEventListener("click", async () => {
  const memberName = prompt("Enter Member Name:");
  if (!memberName) return;

  const membersRef = collection(db, "members");
  const existing = await getDocs(membersRef);
  const exists = existing.docs.find(
    (d) => d.data().name.toLowerCase() === memberName.toLowerCase()
  );
  if (exists) {
    alert("Member already exists!");
    return;
  }

  await addDoc(membersRef, { name: memberName });
  loadMembers();
});

// =============================
// Load Boss Participants List
// =============================
async function loadBossParticipants() {
  participationList.innerHTML = "";
  const weekId = weekSelect.value;
  const weekRef = collection(db, "weeks", weekId, "participations");
  const snapshot = await getDocs(weekRef);

  const bosses = await getDocs(collection(db, "bosses"));
  const bossMap = {};
  bosses.forEach((b) => (bossMap[b.id] = b.data().name));

  const membersSnap = await getDocs(collection(db, "members"));
  const memberMap = {};
  membersSnap.forEach((m) => (memberMap[m.id] = m.data().name));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const div = document.createElement("div");
    const date = formatDate(new Date(data.timestamp));
    const memberNames = data.members.map((id) => memberMap[id]).join(", ");
    div.className = "border p-2 rounded mb-2 bg-gray-100";
    div.innerHTML = `
      <p><strong>${bossMap[data.bossId]}</strong> - ${date}</p>
      <p class="text-sm">Participants: ${memberNames}</p>
      <div class="flex gap-2 mt-1">
        <button class="edit-btn bg-blue-500 text-white px-2 py-1 text-xs rounded">Edit</button>
        <button class="delete-btn bg-red-500 text-white px-2 py-1 text-xs rounded">Delete</button>
      </div>
    `;

    // Edit Participants
    div.querySelector(".edit-btn").addEventListener("click", async () => {
      const editDiv = document.createElement("div");
      editDiv.className = "mt-2 border-t pt-2";
      editDiv.innerHTML = `<p class="font-semibold mb-1">Edit Participants:</p>`;

      const sortedMembers = membersSnap.docs.sort((a, b) =>
        a.data().name.localeCompare(b.data().name)
      );

      const checkList = sortedMembers
        .map((m) => {
          const checked = data.members.includes(m.id) ? "checked" : "";
          return `
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" value="${m.id}" ${checked}>
              ${m.data().name}
            </label>`;
        })
        .join("");

      editDiv.innerHTML += checkList;

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save Changes";
      saveBtn.className =
        "bg-blue-600 text-white px-2 py-1 rounded text-xs mt-2";
      editDiv.appendChild(saveBtn);

      div.appendChild(editDiv);

      saveBtn.addEventListener("click", async () => {
        const newMembers = Array.from(
          editDiv.querySelectorAll("input[type='checkbox']:checked")
        ).map((i) => i.value);
        await updateDoc(
          doc(db, "weeks", weekId, "participations", docSnap.id),
          { members: newMembers }
        );
        loadBossParticipants();
        loadDashboard();
      });
    });

    // Delete
    div.querySelector(".delete-btn").addEventListener("click", async () => {
      await deleteDoc(doc(db, "weeks", weekId, "participations", docSnap.id));
      loadBossParticipants();
      loadDashboard();
    });

    participationList.appendChild(div);
  });
}

// =============================
// Dashboard Summary
// =============================
async function loadDashboard() {
  dashboardDiv.innerHTML = "";
  const weekId = weekSelect.value;
  const participationRef = collection(db, "weeks", weekId, "participations");
  const snapshot = await getDocs(participationRef);

  const membersSnap = await getDocs(collection(db, "members"));
  const memberMap = {};
  membersSnap.forEach((m) => (memberMap[m.id] = m.data().name));

  const counts = {};
  snapshot.forEach((p) => {
    p.data().members.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort(
    (a, b) => b[1] - a[1]
  );

  sorted.forEach(([id, count]) => {
    const div = document.createElement("div");
    div.textContent = `${memberMap[id] || id}: ${count} participation(s)`;
    dashboardDiv.appendChild(div);
  });
}

// =============================
// Initialize
// =============================
(async function init() {
  const currentWeekId = await loadWeeks();
  await loadBosses();
  await loadMembers();
  await loadBossParticipants();
  await loadDashboard();

  weekSelect.addEventListener("change", () => {
    loadBossParticipants();
    loadDashboard();
  });
})();