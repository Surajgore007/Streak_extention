import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-analytics.js';

// ✅ Your Firebase configuration
const firebaseConfig = {
  apiKey: "",
  authDomain: "streak-plugin.firebaseapp.com",
  projectId: "streak-plugin",
  storageBucket: "streak-plugin.firebasestorage.app",
  messagingSenderId: "102820",
  appId: "1:1028",
  measurementId: "G-T89Q6"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ✅ Load streak data
async function displayStreak() {
  const docRef = doc(db, 'streaks', 'user123');
  const docSnap = await getDoc(docRef);
  const streak = docSnap.exists() ? docSnap.data().streak : 0;
  document.getElementById('streak').innerText = `${streak}-day streak`;
}

// ✅ Handle daily reminder button
document.getElementById('reminder-btn').addEventListener('click', () => {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        scheduleReminder();
      }
    });
  } else {
    scheduleReminder();
  }
});

function scheduleReminder() {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 20 && now.getMinutes() === 0) {
      new Notification('Streak Tracker Reminder', {
        body: 'Don’t forget to mark your streak today!',
      });
    }
  }, 60 * 1000); // check every minute
}

displayStreak();
