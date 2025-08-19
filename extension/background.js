// Smart Streak Tracker Background Service Worker with Firebase
class SmartStreakManager {
  constructor() {
    this.firebase = null;
    this.db = null;
    this.userId = null;
    this.initializeExtension();
  }

  async initializeExtension() {
    await this.initFirebase();
    await this.setupUser();
    
    const data = await chrome.storage.local.get(['streakData', 'websiteSettings', 'userSettings']);
    if (!data.streakData) {
      await this.resetStreakData();
    }
    if (!data.websiteSettings) {
      await chrome.storage.local.set({ websiteSettings: {} });
    }
    if (!data.userSettings) {
      await chrome.storage.local.set({ 
        userSettings: {
          syncEnabled: true,
          notificationsEnabled: true,
          theme: 'duolingo'
        }
      });
    }
    
    await this.setupDailyAlarm();
  }

  async initFirebase() {
    try {
      // Import Firebase from CDN
      importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
      importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js');
      importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js');
      
      // You need to replace this with your actual Firebase config
      const firebaseConfig = {
        apiKey: "your-api-key-here",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "your-app-id"
      };

      this.firebase = firebase.initializeApp(firebaseConfig);
      this.db = firebase.firestore();
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      // Continue without Firebase - use local storage only
    }
  }

  async setupUser() {
    try {
      if (!this.firebase) return;
      
      // Generate or retrieve user ID
      const userData = await chrome.storage.local.get(['userId']);
      if (!userData.userId) {
        this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ userId: this.userId });
      } else {
        this.userId = userData.userId;
      }
    } catch (error) {
      console.error("User setup failed:", error);
    }
  }

  async resetStreakData() {
    const initialData = {
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      lastMarkedDate: null,
      streakHistory: [],
      missedDays: 0,
      startDate: new Date().toISOString().split('T')[0],
      buttonShownToday: false,
      lastButtonShowDate: null,
      websiteStreaks: {} // New: per-website streaks
    };
    
    await chrome.storage.local.set({ streakData: initialData });
    return initialData;
  }

  async setupDailyAlarm() {
    await chrome.alarms.clearAll();
    chrome.alarms.create('dailyReset', {
      when: this.getNextMidnight(),
      periodInMinutes: 24 * 60
    });
  }

  getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
  }

  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  getYesterdayString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  async isWebsiteEnabled(domain) {
    const data = await chrome.storage.local.get(['websiteSettings']);
    return data.websiteSettings[domain]?.enabled || false;
  }

  async enableWebsite(domain, enabled = true) {
    const data = await chrome.storage.local.get(['websiteSettings']);
    const settings = data.websiteSettings || {};
    
    if (!settings[domain]) {
      settings[domain] = {
        enabled: enabled,
        dateAdded: new Date().toISOString(),
        totalMarks: 0,
        lastMarked: null
      };
    } else {
      settings[domain].enabled = enabled;
    }
    
    await chrome.storage.local.set({ websiteSettings: settings });
    await this.syncToFirebase();
    return settings[domain];
  }

  async markStreak(domain) {
    const today = this.getTodayString();
    const data = await chrome.storage.local.get(['streakData', 'websiteSettings']);
    let streakData = data.streakData || await this.resetStreakData();
    let websiteSettings = data.websiteSettings || {};

    // Check if website is enabled
    if (!websiteSettings[domain]?.enabled) {
      return {
        success: false,
        message: "Streak tracking not enabled for this website",
        streakData
      };
    }

    // Initialize website streak if not exists
    if (!streakData.websiteStreaks[domain]) {
      streakData.websiteStreaks[domain] = {
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
        lastMarkedDate: null,
        history: []
      };
    }

    const websiteStreak = streakData.websiteStreaks[domain];

    // Prevent marking multiple times on the same day
    if (websiteStreak.lastMarkedDate === today) {
      return {
        success: false,
        message: "Already marked for today on this website!",
        streakData
      };
    }

    const yesterday = this.getYesterdayString();
    
    // Update streak logic
    if (websiteStreak.lastMarkedDate === yesterday) {
      websiteStreak.currentStreak += 1;
    } else if (websiteStreak.lastMarkedDate === null || websiteStreak.currentStreak === 0) {
      websiteStreak.currentStreak = 1;
    } else {
      // Streak broken
      const lastDate = new Date(websiteStreak.lastMarkedDate);
      const todayDate = new Date(today);
      const diffTime = todayDate - lastDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
      
      streakData.missedDays += diffDays;
      websiteStreak.currentStreak = 1;
    }

    // Update records
    websiteStreak.lastMarkedDate = today;
    websiteStreak.totalDays += 1;
    
    if (websiteStreak.currentStreak > websiteStreak.longestStreak) {
      websiteStreak.longestStreak = websiteStreak.currentStreak;
    }

    // Update global stats
    streakData.totalDays += 1;
    if (websiteStreak.currentStreak > streakData.longestStreak) {
      streakData.longestStreak = websiteStreak.currentStreak;
    }

    // Add to history
    websiteStreak.history.push({
      date: today,
      streakDay: websiteStreak.currentStreak,
      timestamp: new Date().toISOString(),
      domain: domain
    });

    // Keep only last 365 days of history
    if (websiteStreak.history.length > 365) {
      websiteStreak.history = websiteStreak.history.slice(-365);
    }

    // Update website settings
    websiteSettings[domain].totalMarks += 1;
    websiteSettings[domain].lastMarked = today;

    // Reset button shown flag for next day
    streakData.buttonShownToday = true;
    streakData.lastButtonShowDate = today;

    await chrome.storage.local.set({ streakData, websiteSettings });
    await this.syncToFirebase();

    // Show success notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: `Streak Marked! 🔥`,
      message: `Day ${websiteStreak.currentStreak} on ${domain}!`
    });

    return {
      success: true,
      message: `Streak marked! Day ${websiteStreak.currentStreak}`,
      streakData,
      websiteStreak
    };
  }

  async getStreakData(domain = null) {
    const data = await chrome.storage.local.get(['streakData', 'websiteSettings']);
    const streakData = data.streakData || await this.resetStreakData();
    
    if (domain && streakData.websiteStreaks[domain]) {
      return {
        ...streakData,
        currentWebsiteStreak: streakData.websiteStreaks[domain],
        websiteEnabled: data.websiteSettings[domain]?.enabled || false
      };
    }
    
    return streakData;
  }

  async shouldShowButton(domain) {
    const today = this.getTodayString();
    const data = await chrome.storage.local.get(['streakData', 'websiteSettings']);
    const streakData = data.streakData || await this.resetStreakData();
    const websiteSettings = data.websiteSettings || {};
    
    // Don't show if website not enabled
    if (!websiteSettings[domain]?.enabled) {
      return false;
    }
    
    // Don't show if already marked today for this website
    if (streakData.websiteStreaks[domain]?.lastMarkedDate === today) {
      return false;
    }
    
    // Don't show if button was already shown today
    if (streakData.buttonShownToday && streakData.lastButtonShowDate === today) {
      return false;
    }
    
    return true;
  }

  async getWebsiteSettings() {
    const data = await chrome.storage.local.get(['websiteSettings']);
    return data.websiteSettings || {};
  }

  async syncToFirebase() {
    try {
      if (!this.db || !this.userId) return;
      
      const data = await chrome.storage.local.get(['streakData', 'websiteSettings', 'userSettings']);
      
      await this.db.collection('users').doc(this.userId).set({
        streakData: data.streakData,
        websiteSettings: data.websiteSettings,
        userSettings: data.userSettings,
        lastSync: new Date().toISOString()
      }, { merge: true });
      
      console.log("Data synced to Firebase successfully");
    } catch (error) {
      console.error("Firebase sync failed:", error);
    }
  }

  async syncFromFirebase() {
    try {
      if (!this.db || !this.userId) return;
      
      const doc = await this.db.collection('users').doc(this.userId).get();
      
      if (doc.exists) {
        const data = doc.data();
        await chrome.storage.local.set({
          streakData: data.streakData || {},
          websiteSettings: data.websiteSettings || {},
          userSettings: data.userSettings || {}
        });
        
        console.log("Data synced from Firebase successfully");
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Firebase sync failed:", error);
      return false;
    }
  }

  async getStreakStats(domain = null) {
    const streakData = await this.getStreakData(domain);
    const today = this.getTodayString();
    
    let currentStreak = 0;
    let longestStreak = streakData.longestStreak;
    let totalDays = streakData.totalDays;
    let lastMarkedDate = null;
    let status = 'inactive';
    
    if (domain && streakData.websiteStreaks[domain]) {
      const websiteStreak = streakData.websiteStreaks[domain];
      currentStreak = websiteStreak.currentStreak;
      longestStreak = websiteStreak.longestStreak;
      totalDays = websiteStreak.totalDays;
      lastMarkedDate = websiteStreak.lastMarkedDate;
    }
    
    // Calculate streak status
    if (lastMarkedDate === today) {
      status = 'active';
    } else if (currentStreak > 0) {
      const yesterday = this.getYesterdayString();
      status = lastMarkedDate === yesterday ? 'pending' : 'broken';
    } else {
      status = 'inactive';
    }

    // Calculate success rate
    const startDate = new Date(streakData.startDate);
    const daysSinceStart = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24));
    const successRate = totalDays > 0 ? Math.round((totalDays / daysSinceStart) * 100) : 0;

    return {
      currentStreak,
      longestStreak,
      totalDays,
      status,
      successRate,
      daysSinceStart,
      canMarkToday: lastMarkedDate !== today,
      websiteEnabled: domain ? streakData.websiteEnabled : true,
      domain
    };
  }
}

// Initialize streak manager
const streakManager = new SmartStreakManager();

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const domain = request.domain || (sender.tab?.url ? streakManager.getDomainFromUrl(sender.tab.url) : null);
      
      switch (request.action) {
        case "markStreak":
          const result = await streakManager.markStreak(domain);
          sendResponse(result);
          break;
          
        case "getStreak":
          const streakData = await streakManager.getStreakData(domain);
          sendResponse(streakData);
          break;
          
        case "getStreakStats":
          const stats = await streakManager.getStreakStats(domain);
          sendResponse(stats);
          break;
          
        case "shouldShowButton":
          const shouldShow = await streakManager.shouldShowButton(domain);
          sendResponse({ shouldShow });
          break;
          
        case "enableWebsite":
          const websiteData = await streakManager.enableWebsite(domain, request.enabled);
          sendResponse(websiteData);
          break;
          
        case "getWebsiteSettings":
          const settings = await streakManager.getWebsiteSettings();
          sendResponse(settings);
          break;
          
        case "syncFromFirebase":
          const synced = await streakManager.syncFromFirebase();
          sendResponse({ synced });
          break;
          
        case "syncToFirebase":
          await streakManager.syncToFirebase();
          sendResponse({ synced: true });
          break;
          
        default:
          sendResponse({ error: "Unknown action" });
      }
    } catch (error) {
      console.error("Error in background script:", error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true;
});

// Alarm listener for daily reset
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    const data = await streakManager.getStreakData();
    data.buttonShownToday = false;
    data.lastButtonShowDate = null;
    
    await chrome.storage.local.set({ streakData: data });
    await streakManager.syncToFirebase();
    
    // Check for broken streaks and send notifications
    const today = streakManager.getTodayString();
    const yesterday = streakManager.getYesterdayString();
    
    Object.keys(data.websiteStreaks).forEach(domain => {
      const streak = data.websiteStreaks[domain];
      if (streak.lastMarkedDate !== yesterday && streak.lastMarkedDate !== today && streak.currentStreak > 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Streak at Risk! ⚠️',
          message: `Your ${streak.currentStreak}-day streak on ${domain} needs attention!`
        });
      }
    });
  }
});

// Installation listener
chrome.runtime.onInstalled.addListener(() => {
  console.log("Smart Streak Tracker installed successfully!");
});