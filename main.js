import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// Utility
function getWeekId(date = new Date()) {
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toISOString().split("T")[0]}_${sunday.toISOString().split("T")[0]}`;
}
function getSelectedWeek() {
  return document.getElementById("week-selector").value;
}

// --- Load Week Options ---
async function loadWeeks() {
  const weekSelector = document.getElementById("week-selector");
  const snapshot = await getDocs(collection(db, "weeks"));
  const weeks = [];
  snapshot.forEach(doc => weeks.push(doc.id));
  if (weeks.length === 0) {
    const defaultWeek = getWeekId();
    await setDoc(doc(collection(db, "weeks"), defaultWeek), { bosses: [], totalEarnings: 0 });
    weeks.push(defaultWeek);
  }
  weeks.sort().reverse();
  weekSelector.innerHTML = weeks.map(w => `<option value="${w}">${w}</option>`).join("");
}

// --- Load Dashboard ---
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
  memberSnapshot.forEach(docSnap => (memberMap[docSnap.id] = docSnap.data().name));

  const counts = {};
  bosses.forEach(b => b.participants.forEach(p => (counts[p] = (counts[p] || 0) + 1)));

  const totalParticipation = Object.values(counts).reduce((a, b) => a + b, 0);
  const goldPerParticipation = totalParticipation > 0 ? totalEarnings / totalParticipation : 0;

  container.innerHTML =
    Object.entries(counts)
      .map(([id, count]) => {
        const name = memberMap[id] || "(Unknown Member)";
        return `
          <div class='p-2 border-b flex justify-between'>
            <span>${name}</span>
            <span>${count} runs (${(count * goldPerParticipation).toFixed(1)} gold)</span>
          </div>
        `;
      })
      .join("") || "<p class='text-gray-500'>No participation yet.</p>";

  // --- Boss Participants Chart ---
  if (bosses.length > 0) {
    bosses.sort((a, b) => {
      const da = a.date ? new Date(a.date.seconds * 1000) : new Date(0);
      const db = b.date ? new Date(b.date.seconds * 1000) : new Date(0);
      return db - da;
    });

    const bossDetailsHTML = bosses
      .map((b, index) => {
        const bossName = b.name || "(Unnamed Boss)";
        const date = b.date
          ? new Date(b.date.seconds * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          : "(No Date)";
        const participantsList = b.participants
          .map(pId => memberMap[pId] || "(Unknown)")
          .join(", ");

        return `
          <div class="p-3 border rounded-xl bg-gray-50 shadow-sm mb-2">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-semibold text-lg">${bossName}</div>
                <div class="text-sm text-gray-600">${date}</div>
                <div class="mt-1 text-sm">Participants: ${participantsList || "None"}</div>
              </div>
              <div class="flex gap-2">
                <button onclick="editBossParticipants(${index})" class="px-2 py-1 bg-blue-500 text-white rounded-md text-xs">✏️ Edit</button>
                <button onclick="deleteBossRecord(${index})" class="px-2 py-1 bg-red-500 text-white rounded-md text-xs">🗑 Delete</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML += `
      <h2 class="text-xl font-bold mt-6 mb-2">Boss Participants (This Week)</h2>
      <div>${bossDetailsHTML}</div>
    `;
  } else {
    container.innerHTML += `
      <h2 class="text-xl font-bold mt-6 mb-2">Boss Participants (This Week)</h2>
      <p class='text-gray-500'>No boss records this week.</p>
    `;
  }
}

// --- Delete a Boss Record ---
window.deleteBossRecord = async function (index) {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  if (!confirm(`Delete record for "${bosses[index].name}"?`)) return;

  bosses.splice(index, 1);
  await updateDoc(weekRef, { bosses });
  alert("Boss record deleted!");
  loadDashboard();
};

// --- Edit Participants ---
window.editBossParticipants = async function (index) {
  const weekId = getSelectedWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;

  const weekData = snap.data();
  const bosses = weekData.bosses || [];
  const boss = bosses[index];
  if (!boss) return;

  const memberSnapshot = await getDocs(collection(db, "members"));
  const members = [];
  memberSnapshot.forEach(docSnap => members.push({ id: docSnap.id, name: docSnap.data().name }));

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";

  const modal = document.createElement("div");
  modal.className = "bg-white rounded-2xl shadow-lg p-6 w-80 max-h-[90vh] overflow-y-auto";

  modal.innerHTML = `
    <h2 class="text-lg font-bold mb-3">Edit Participants</h2>
    <p class="mb-2 text-sm text-gray-600">${boss.name}</p>
    <div class="mb-3">
      ${members
        .map(
          m => `
        <label class="flex items-center gap-2">
          <input type="checkbox" value="${m.id}" ${
            boss.participants.includes(m.id) ? "checked" : ""
          }>
          ${m.name}
        </label>`
        )
        .join("")}
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button id="cancelEdit" class="px-3 py-1 bg-gray-400 text-white rounded">Cancel</button>
      <button id="saveEdit" class="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector("#cancelEdit").onclick = () => overlay.remove();

  modal.querySelector("#saveEdit").onclick = async () => {
    const selected = Array.from(modal.querySelectorAll("input:checked")).map(c => c.value);
    bosses[index].participants = selected;

    await updateDoc(weekRef, { bosses });
    alert("Participants updated!");
    overlay.remove();
    loadDashboard();
  };
};

// --- Initial Load ---
await loadWeeks();
document.getElementById("week-selector").addEventListener("change", loadDashboard);
loadDashboard();