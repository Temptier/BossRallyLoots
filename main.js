import { db, collection, doc, setDoc, updateDoc, getDoc, arrayUnion } from './firebase.js';

// Helpers
const getCurrentWeekId = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `week-${monday.toISOString().slice(0,10)}`;
};

// Auto-create current week if not exists
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

// Add member
document.getElementById("add-member").addEventListener("click", async () => {
  const name = document.getElementById("member-name").value;
  if (!name) return alert("Enter a name");
  const memberRef = doc(collection(db, "members"));
  await setDoc(memberRef, { name, createdAt: new Date() });
  document.getElementById("member-name").value = "";
  loadMembers();
});

// Load members
async function loadMembers() {
  const memberList = document.getElementById("member-list");
  const checkboxes = document.getElementById("member-checkboxes");
  memberList.innerHTML = "";
  checkboxes.innerHTML = "";

  const snapshot = await (await import('https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js')).getDocs(collection(db, "members"));
  snapshot.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = doc.data().name;
    memberList.appendChild(li);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = doc.id;
    const label = document.createElement("label");
    label.textContent = doc.data().name;
    label.prepend(cb);
    checkboxes.appendChild(label);
    checkboxes.appendChild(document.createElement("br"));
  });
}

// Add boss
document.getElementById("add-boss").addEventListener("click", async () => {
  const bossName = document.getElementById("boss-name").value;
  if (!bossName) return alert("Enter boss name");
  const participantIds = Array.from(document.querySelectorAll("#member-checkboxes input:checked")).map(cb => cb.value);
  if (participantIds.length === 0) return alert("Select participants");

  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);

  await updateDoc(weekRef, {
    bosses: arrayUnion({ name: bossName, participants: participantIds })
  });
  document.getElementById("boss-name").value = "";
  loadDashboard();
});

// Update total earnings
document.getElementById("update-earnings").addEventListener("click", async () => {
  const earnings = Number(document.getElementById("total-earnings").value);
  if (isNaN(earnings)) return alert("Enter a valid number");
  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  await updateDoc(weekRef, { totalEarnings: earnings });
  loadDashboard();
});

// Calculate earnings
async function calculateEarnings(weekData) {
  const bosses = weekData.bosses || [];
  const totalEarnings = weekData.totalEarnings || 0;

  const participationCount = {};
  bosses.forEach(boss => {
    boss.participants.forEach(id => {
      participationCount[id] = (participationCount[id] || 0) + 1;
    });
  });

  const totalParticipations = Object.values(participationCount).reduce((a,b) => a+b, 0) || 1;

  const earnings = {};
  for (const [id, count] of Object.entries(participationCount)) {
    earnings[id] = Math.floor((count / totalParticipations) * totalEarnings);
  }
  return earnings;
}

// Load dashboard
async function loadDashboard() {
  const weekId = await ensureCurrentWeek();
  const weekRef = doc(collection(db, "weeks"), weekId);
  const snap = await getDoc(weekRef);
  if (!snap.exists()) return;
  const weekData = snap.data();
  const earnings = await calculateEarnings(weekData);

  const dash = document.getElementById("dashboard-content");
  dash.innerHTML = "";
  for (const [memberId, earning] of Object.entries(earnings)) {
    const memberDoc = await getDoc(doc(collection(db, "members"), memberId));
    const name = memberDoc.exists() ? memberDoc.data().name : "Unknown";
    const participations = weekData.bosses.filter(b => b.participants.includes(memberId)).length;
    const div = document.createElement("div");
    div.textContent = `${name} – Participations: ${participations} – Earnings: ${earning} gold`;
    dash.appendChild(div);
  }
}

// Delete week
document.getElementById("delete-week").addEventListener("click", async () => {
  if (!confirm("Are you sure? This will delete current week data")) return;
  const weekId = await ensureCurrentWeek();
  await (await import('https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js')).deleteDoc(doc(collection(db,"weeks"), weekId));
  loadDashboard();
});

// Initial load
loadMembers();
loadDashboard();