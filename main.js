import { db, collection, doc, setDoc, updateDoc, getDoc, arrayUnion } from './firebase.js';

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

// Add boss with participants
document.getElementById("add-boss").addEventListener("click", async () => {
  const bossName = document.getElementById("boss-name").value;
  if (!bossName) return alert("Enter boss name");

  const participantIds = Array.from(document.querySelectorAll("#member-checkboxes input:checked")).map(cb => cb.value);
  if (participantIds.length === 0) return alert("Select at least one participant");

  const weekRef = doc(collection(db, "weeks"), "current-week"); // simple single-week for now
  await updateDoc(weekRef, {
    bosses: arrayUnion({ name: bossName, participants: participantIds })
  });

  document.getElementById("boss-name").value = "";
  loadDashboard();
});

// Load Dashboard (simplified)
async function loadDashboard() {
  const weekRef = doc(collection(db, "weeks"), "current-week");
  const weekSnap = await getDoc(weekRef);
  if (!weekSnap.exists()) return;

  const dashboard = document.getElementById("dashboard-content");
  dashboard.innerHTML = JSON.stringify(weekSnap.data(), null, 2);
}

loadMembers();
loadDashboard();