// ---------------- Firebase Setup ----------------
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

// ---------------- Utilities ----------------
function getSelectedWeek() {
  const select = document.getElementById("week-selector");
  return select.value;
}

async function loadWeeks() {
  const weekRef = collection(db, "weeks");
  const snap = await getDocs(weekRef);
  const select = document.getElementById("week-selector");
  select.innerHTML = "";
  snap.forEach((docSnap) => {
    const week = docSnap.data();
    const start = new Date(week.start?.seconds * 1000);
    const end = new Date(week.end?.seconds * 1000);
    const label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

// ---------------- Members ----------------
async function loadMembers() {
  const membersRef = collection(db, "members");
  const snap = await getDocs(membersRef);
  const container = document.getElementById("member-chips");
  container.innerHTML = "";
  snap.forEach((docSnap) => {
    const m = docSnap.data();
    const div = document.createElement("div");
    div.className = "member-chip px-2 py-1 m-1 border rounded cursor-pointer";
    div.textContent = m.name;
    div.dataset.id = docSnap.id;
    div.addEventListener("click", () => div.classList.toggle("bg-green-300"));
    container.appendChild(div);
  });
}

// ---------------- Bosses ----------------
async function loadGlobalBosses() {
  const bossesRef = collection(db, "bosses");
  const snap = await getDocs(bossesRef);
  const container = document.getElementById("boss-chips");
  container.innerHTML = "";
  snap.forEach((docSnap) => {
    const b = docSnap.data();
    const div = document.createElement("div");
    div.className = "boss-chip px-2 py-1 m-1 border rounded cursor-pointer";
    div.textContent = b.name;
    div.dataset.id = docSnap.id;
    div.addEventListener("click", () => {
      document.getElementById("selected-boss").textContent = b.name;
      document.getElementById("selected-boss").dataset.id = docSnap.id;
      document.getElementById("boss-float").classList.add("hidden");
    });
    container.appendChild(div);
  });
}

// ---------------- Add Boss Participation ----------------
async function addBossParticipation() {
  const bossId = document.getElementById("selected-boss").dataset.id;
  const bossName = document.getElementById("selected-boss").textContent;
  const weekId = getSelectedWeek();
  const members = Array.from(
    document.querySelectorAll("#member-chips .bg-green-300")
  ).map((el) => el.dataset.id);

  if (!bossId || !members.length || !weekId) {
    alert("Select a boss, members, and week.");
    return;
  }

  const weekRef = doc(collection(db, "weeks"), weekId);
  const weekSnap = await getDoc(weekRef);
  const weekData = weekSnap.data();
  const bosses = weekData.bosses || [];

  bosses.push({
    id: crypto.randomUUID(),
    name: bossName,
    bossId,
    participants: members,
    date: new Date(),
  });

  await updateDoc(weekRef, { bosses });
  alert("Boss participation added!");
  loadBossParticipants();
  loadDashboard();
}

// ---------------- Dashboard ----------------
async function loadDashboard() {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const section = document.getElementById("dashboard");

  if (!snap.exists()) {
    section.innerHTML = "<p class='text-gray-500'>No data for this week.</p>";
    return;
  }

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  section.innerHTML = `<p>Total Records: ${bosses.length}</p>`;
}

// ---------------- Boss Participants Chart ----------------
async function loadBossParticipants() {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const section = document.getElementById("boss-participants");

  if (!snap.exists()) {
    section.innerHTML = "<p class='text-gray-500'>No data for this week.</p>";
    return;
  }

  const weekData = snap.data();
  const bosses = weekData.bosses || [];

  const memberSnapshot = await getDocs(collection(db, "members"));
  const memberMap = {};
  memberSnapshot.forEach((docSnap) => {
    memberMap[docSnap.id] = docSnap.data().name;
  });

  section.innerHTML =
    bosses
      .map(
        (entry) => `
      <div class="p-2 border-b flex justify-between items-start">
        <div>
          <div class="font-semibold">${entry.name}</div>
          <div class="text-sm text-gray-600">${
            entry.date
              ? new Date(entry.date.seconds * 1000).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "(no date)"
          }</div>
          <div class="text-sm">${entry.participants
            .map((id) => memberMap[id] || "(Unknown)")
            .join(", ")}</div>
        </div>
        <div class="flex gap-2">
          <button onclick="editBossEntry('${entry.id}')" class="text-blue-500">Edit</button>
          <button onclick="deleteBossEntry('${entry.id}')" class="text-red-500">Delete</button>
        </div>
      </div>`
      )
      .join("") || "<p class='text-gray-500'>No boss records yet.</p>";
}

// ---------------- Edit Boss Entry ----------------
window.editBossEntry = async function (entryId) {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const weekData = snap.data();
  const bosses = weekData.bosses || [];

  const entry = bosses.find((b) => b.id === entryId);
  if (!entry) return alert("Entry not found");

  // Highlight current participants
  const memberChips = document.querySelectorAll("#member-chips .member-chip");
  memberChips.forEach((chip) => {
    if (entry.participants.includes(chip.dataset.id))
      chip.classList.add("bg-green-300");
    else chip.classList.remove("bg-green-300");
  });

  document.getElementById("selected-boss").textContent = entry.name;
  document.getElementById("selected-boss").dataset.id = entry.bossId;
  document.getElementById("edit-entry-id").value = entryId;
  alert("Edit mode: now update participants and press Save Changes.");
};

// ---------------- Save Edit ----------------
async function saveEditedBossEntry() {
  const entryId = document.getElementById("edit-entry-id").value;
  if (!entryId) return addBossParticipation();

  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const weekSnap = await getDoc(weekRef);
  const weekData = weekSnap.data();
  const bosses = weekData.bosses || [];

  const members = Array.from(
    document.querySelectorAll("#member-chips .bg-green-300")
  ).map((el) => el.dataset.id);

  const updated = bosses.map((b) =>
    b.id === entryId ? { ...b, participants: members } : b
  );

  await updateDoc(weekRef, { bosses: updated });
  alert("Boss entry updated!");
  document.getElementById("edit-entry-id").value = "";
  loadBossParticipants();
  loadDashboard();
}

// ---------------- Delete Boss Entry ----------------
window.deleteBossEntry = async function (entryId) {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  const weekData = snap.data();
  const bosses = weekData.bosses || [];

  const updated = bosses.filter((b) => b.id !== entryId);
  await updateDoc(weekRef, { bosses: updated });
  alert("Entry deleted!");
  loadBossParticipants();
  loadDashboard();
};

// ---------------- Init ----------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadWeeks();
  await loadMembers();
  await loadGlobalBosses();
  await loadDashboard();
  await loadBossParticipants();

  document
    .getElementById("week-selector")
    .addEventListener("change", () => {
      loadDashboard();
      loadBossParticipants();
    });

  document
    .getElementById("add-boss-btn")
    .addEventListener("click", saveEditedBossEntry);
});