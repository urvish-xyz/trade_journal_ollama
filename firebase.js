// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB-GRuTs_ja2AEm8j8D7sCaKGIUqXnTaA",
  authDomain: "trade-journal-1c05d.firebaseapp.com",
  projectId: "trade-journal-1c05d",
  storageBucket: "trade-journal-1c05d.firebasestorage.app",
  messagingSenderId: "1075590598746",
  appId: "1:1075590598746:web:3fb96fecf3884a6cedc863",
  measurementId: "G-TC98BS4C89"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();

// Cache settings for offline support
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Helper functions
const FirebaseDB = {
  // Login/Register user
  async login(userId, secretKey) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.secretKey === secretKey) {
          return { success: true, userId, isNew: false };
        } else {
          return { success: false, error: 'Invalid secret key' };
        }
      } else {
        return { success: false, error: 'Account not found' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Create new account
  async createAccount(userId, secretKey) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        return { success: false, error: 'Username already taken' };
      }
      
      await db.collection('users').doc(userId).set({
        secretKey: secretKey,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true, userId, isNew: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get trades for user
  async getTrades(userId) {
    try {
      const tradesSnapshot = await db.collection('users').doc(userId)
        .collection('trades')
        .orderBy('entryTime', 'desc')
        .get();
      
      const trades = [];
      tradesSnapshot.forEach(doc => {
        trades.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, trades };
    } catch (err) {
      return { success: false, error: err.message, trades: [] };
    }
  },

  // Save trade
  async saveTrade(userId, trade) {
    try {
      if (trade.id) {
        // Update existing
        await db.collection('users').doc(userId)
          .collection('trades')
          .doc(trade.id)
          .set(trade);
      } else {
        // Add new
        const docRef = await db.collection('users').doc(userId)
          .collection('trades')
          .add(trade);
        trade.id = docRef.id;
      }
      return { success: true, trade };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Delete trade
  async deleteTrade(userId, tradeId) {
    try {
      await db.collection('users').doc(userId)
        .collection('trades')
        .doc(tradeId)
        .delete();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get settings for user
  async getSettings(userId) {
    try {
      const settingsDoc = await db.collection('users').doc(userId)
        .collection('settings')
        .doc('config')
        .get();
      
      if (settingsDoc.exists) {
        return { success: true, settings: settingsDoc.data() };
      }
      return { success: true, settings: { defaultRisk: 2, theme: 'auto' } };
    } catch (err) {
      return { success: false, error: err.message, settings: {} };
    }
  },

  // Save settings
  async saveSettings(userId, settings) {
    try {
      await db.collection('users').doc(userId)
        .collection('settings')
        .doc('config')
        .set(settings);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get strategies for user
  async getStrategies(userId) {
    try {
      const strategiesDoc = await db.collection('users').doc(userId)
        .collection('data')
        .doc('strategies')
        .get();
      
      if (strategiesDoc.exists) {
        return { success: true, strategies: strategiesDoc.data().list };
      }
      return { success: true, strategies: ['Breakout', 'Reversal', 'Break & Fake', 'Trend Follow'] };
    } catch (err) {
      return { success: false, error: err.message, strategies: [] };
    }
  },

  // Save strategies
  async saveStrategies(userId, strategies) {
    try {
      await db.collection('users').doc(userId)
        .collection('data')
        .doc('strategies')
        .set({ list: strategies });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Get tags for user
  async getTags(userId) {
    try {
      const tagsDoc = await db.collection('users').doc(userId)
        .collection('data')
        .doc('tags')
        .get();
      
      if (tagsDoc.exists) {
        return { success: true, tags: tagsDoc.data().list };
      }
      return { success: true, tags: ['News', 'Earnings', 'Pattern', ' setup'] };
    } catch (err) {
      return { success: false, error: err.message, tags: [] };
    }
  },

  // Save tags
  async saveTags(userId, tags) {
    try {
      await db.collection('users').doc(userId)
        .collection('data')
        .doc('tags')
        .set({ list: tags });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};