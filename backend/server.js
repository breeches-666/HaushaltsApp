const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const admin = require('firebase-admin');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// Firebase Admin SDK initialisieren
// Wichtig: In Production muss FIREBASE_SERVICE_ACCOUNT als JSON string in .env gesetzt sein
// Beispiel: FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialisiert');
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT nicht gefunden - Push Notifications deaktiviert');
  }
} catch (error) {
  console.error('❌ Firebase Initialisierung fehlgeschlagen:', error.message);
}

// Middleware
// CORS-Konfiguration - erlaubt alle Origins
// Da wir JWT-Auth verwenden (nicht Cookie-basiert), brauchen wir keine credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Erlaubt alle Origins
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/haushaltsplaner')
.then(() => console.log('✅ MongoDB verbunden'))
.catch(err => console.error('❌ MongoDB Fehler:', err));

// Schemas
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fcmToken: { type: String, default: null }, // Firebase Cloud Messaging Token für Push Notifications
  notificationPreferences: {
    dailyTaskReminder: { type: Boolean, default: true }, // Tägliche Erinnerung für heutige Aufgaben
    reminderTime: { type: String, default: '07:00' }, // Uhrzeit für tägliche Erinnerung (HH:MM)
    deadlineNotifications: { type: Boolean, default: true }, // Benachrichtigungen für Deadlines
    taskAssignments: { type: Boolean, default: true } // Benachrichtigungen bei Aufgaben-Zuweisung
  },
  createdAt: { type: Date, default: Date.now }
});

const HouseholdSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: String, required: true }], // User IDs
  createdBy: { type: String, required: true },
  isPrivate: { type: Boolean, default: false }, // Private Haushalte können nicht geteilt werden
  invites: [{
    email: String,
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    invitedAt: { type: Date, default: Date.now }
  }],
  terminalToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

HouseholdSchema.index({ terminalToken: 1 }, { sparse: true });

const TaskSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  deadline: Date,
  assignedTo: { type: [String], default: [] }, // Array von User IDs (Mehrfachzuweisung möglich)
  completed: { type: Boolean, default: false },
  completedAt: Date,
  completedBy: String,
  archived: { type: Boolean, default: false }, // Archiviert nach 14 Tagen
  hourNotified: { type: Boolean, default: false },
  overdueNotified: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, // Dringlichkeit
  description: { type: String, default: '' }, // Optionale Beschreibung
  // Wiederkehrende Aufgaben
  recurrence: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    interval: { type: Number, default: 1 }, // z.B. alle 2 Wochen = interval: 2, frequency: 'weekly'
    lastRecurrence: Date // Wann wurde die Task zuletzt wiederholt
  },
  createdAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Household = mongoose.model('Household', HouseholdSchema);
const Task = mongoose.model('Task', TaskSchema);
const Category = mongoose.model('Category', CategorySchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });

  jwt.verify(token, process.env.JWT_SECRET || 'dein-geheimer-schluessel', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ungültig' });
    req.user = user;
    next();
  });
};

// Terminal Middleware
const authenticateTerminal = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const household = await Household.findOne({ terminalToken: token });
    if (!household) return res.status(403).json({ error: 'Token ungültig' });
    req.terminalHousehold = household;
    req.isTerminal = true;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
};

const authenticateAny = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });

  // Try terminal token first (DB lookup)
  try {
    const household = await Household.findOne({ terminalToken: token });
    if (household) {
      req.terminalHousehold = household;
      req.isTerminal = true;
      return next();
    }
  } catch (e) {
    // fall through to JWT
  }

  // Try JWT
  jwt.verify(token, process.env.JWT_SECRET || 'dein-geheimer-schluessel', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ungültig' });
    req.user = user;
    req.isTerminal = false;
    next();
  });
};

// Push Notification Hilfsfunktionen
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // Prüfe ob Firebase initialisiert ist
    if (!admin.apps.length) {
      console.log('Push Notification übersprungen (Firebase nicht initialisiert)');
      return false;
    }

    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.log(`Push Notification übersprungen (kein FCM Token für User ${userId})`);
      return false;
    }

    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token: user.fcmToken,
      android: {
        priority: 'high',
        notification: {
          channelId: 'haushaltsapp_channel',
          sound: 'default'
        }
      }
    };

    await admin.messaging().send(message);
    console.log(`✅ Push Notification gesendet an User ${userId}: ${title}`);
    return true;
  } catch (error) {
    console.error(`❌ Push Notification Fehler für User ${userId}:`, error.message);

    // Wenn Token ungültig ist, lösche ihn
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      await User.findByIdAndUpdate(userId, { fcmToken: null });
      console.log(`FCM Token für User ${userId} gelöscht (ungültig)`);
    }

    return false;
  }
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword
    });
    await user.save();

    // Erstelle privaten Haushalt für neuen Benutzer
    const household = new Household({
      name: `Mein privater Haushalt`,
      members: [user._id.toString()],
      createdBy: user._id.toString(),
      isPrivate: true // Privater Haushalt, kann nicht geteilt werden
    });
    await household.save();

    // Erstelle Standard-Kategorien
    const defaultCategories = [
      { householdId: household._id.toString(), name: 'Küche', color: '#ef4444' },
      { householdId: household._id.toString(), name: 'Bad', color: '#3b82f6' },
      { householdId: household._id.toString(), name: 'Wohnzimmer', color: '#10b981' }
    ];
    await Category.insertMany(defaultCategories);

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'dein-geheimer-schluessel',
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Falsche Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Falsche Anmeldedaten' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'dein-geheimer-schluessel',
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Login-Fehler:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// FCM Token Registration
app.post('/api/user/fcm-token', authenticateToken, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM Token erforderlich' });
    }

    await User.findByIdAndUpdate(req.user.id, { fcmToken });
    console.log(`✅ FCM Token registriert für User ${req.user.id}`);

    res.json({ message: 'FCM Token erfolgreich registriert' });
  } catch (error) {
    console.error('FCM Token Registrierung fehlgeschlagen:', error);
    res.status(500).json({ error: 'FCM Token Registrierung fehlgeschlagen' });
  }
});

// Notification Preferences
app.get('/api/user/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json(user.notificationPreferences || {
      dailyTaskReminder: true,
      reminderTime: '07:00',
      deadlineNotifications: true,
      taskAssignments: true
    });
  } catch (error) {
    console.error('Fehler beim Laden der Benachrichtigungseinstellungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benachrichtigungseinstellungen' });
  }
});

app.put('/api/user/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { dailyTaskReminder, reminderTime, deadlineNotifications, taskAssignments } = req.body;

    const updateData = { notificationPreferences: {} };

    if (dailyTaskReminder !== undefined) updateData.notificationPreferences.dailyTaskReminder = dailyTaskReminder;
    if (reminderTime !== undefined) updateData.notificationPreferences.reminderTime = reminderTime;
    if (deadlineNotifications !== undefined) updateData.notificationPreferences.deadlineNotifications = deadlineNotifications;
    if (taskAssignments !== undefined) updateData.notificationPreferences.taskAssignments = taskAssignments;

    await User.findByIdAndUpdate(req.user.id, updateData);
    console.log(`✅ Benachrichtigungseinstellungen aktualisiert für User ${req.user.id}`);

    res.json({ message: 'Benachrichtigungseinstellungen erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Benachrichtigungseinstellungen:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Benachrichtigungseinstellungen' });
  }
});

// Household Routes
app.get('/api/households', authenticateToken, async (req, res) => {
  try {
    const households = await Household.find({
      members: req.user.id
    });

    // Hole Benutzerinformationen für alle Mitglieder
    const householdsWithMembers = await Promise.all(
      households.map(async (household) => {
        const members = await User.find({
          _id: { $in: household.members }
        }).select('name email');

        return {
          ...household.toObject(),
          memberDetails: members
        };
      })
    );

    res.json(householdsWithMembers);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Haushalte' });
  }
});

app.post('/api/households', authenticateToken, async (req, res) => {
  try {
    const { name, isPrivate = false } = req.body;

    const household = new Household({
      name,
      members: [req.user.id],
      createdBy: req.user.id,
      isPrivate // Gemeinsame Haushalte haben isPrivate: false
    });
    await household.save();

    // Erstelle Standard-Kategorien für neuen Haushalt
    const defaultCategories = [
      { householdId: household._id.toString(), name: 'Küche', color: '#ef4444' },
      { householdId: household._id.toString(), name: 'Bad', color: '#3b82f6' },
      { householdId: household._id.toString(), name: 'Wohnzimmer', color: '#10b981' }
    ];
    await Category.insertMany(defaultCategories);

    res.json(household);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen des Haushalts' });
  }
});

// Haushalt löschen (nur wenn User einziges Mitglied ist)
app.delete('/api/households/:id', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);

    if (!household) {
      return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    }

    // Prüfe ob User Mitglied ist
    if (!household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Prüfe ob User einziges Mitglied ist
    if (household.members.length > 1) {
      return res.status(400).json({
        error: 'Haushalt kann nur gelöscht werden, wenn du das einzige Mitglied bist. Aktuell sind noch ' + household.members.length + ' Mitglieder im Haushalt.'
      });
    }

    // Private Haushalte dürfen nicht gelöscht werden (jeder Nutzer braucht mindestens einen)
    if (household.isPrivate) {
      return res.status(400).json({ error: 'Private Haushalte können nicht gelöscht werden' });
    }

    const householdId = household._id.toString();

    // Lösche alle Tasks des Haushalts
    await Task.deleteMany({ householdId });

    // Lösche alle Kategorien des Haushalts
    await Category.deleteMany({ householdId });

    // Lösche den Haushalt
    await Household.findByIdAndDelete(req.params.id);

    res.json({ message: 'Haushalt erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Haushalts:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Haushalts' });
  }
});

app.post('/api/households/:id/invite', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const household = await Household.findById(req.params.id);

    if (!household) {
      return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    }

    if (household.isPrivate) {
      return res.status(400).json({ error: 'Private Haushalte können nicht geteilt werden' });
    }

    if (!household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Prüfe ob User existiert
    const invitedUser = await User.findOne({ email });
    if (!invitedUser) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Prüfe ob bereits Mitglied
    if (household.members.includes(invitedUser._id.toString())) {
      return res.status(400).json({ error: 'Benutzer ist bereits Mitglied' });
    }

    // Prüfe ob bereits eingeladen
    const existingInvite = household.invites.find(inv => inv.email === email && inv.status === 'pending');
    if (existingInvite) {
      return res.status(400).json({ error: 'Einladung bereits versendet' });
    }

    household.invites.push({
      email,
      status: 'pending'
    });
    await household.save();

    // Sende Push Notification an eingeladenen User
    const inviter = await User.findById(req.user.id);
    await sendPushNotification(
      invitedUser._id,
      'Neue Haushalt-Einladung',
      `${inviter.name} hat dich zu "${household.name}" eingeladen`,
      { type: 'invitation', householdId: household._id.toString() }
    );

    res.json({ message: 'Einladung versendet', household });
  } catch (error) {
    console.error('Einladungsfehler:', error);
    res.status(500).json({ error: 'Fehler beim Versenden der Einladung' });
  }
});

app.get('/api/households/invites', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const households = await Household.find({
      'invites.email': user.email,
      'invites.status': 'pending'
    });

    const invites = households.map(h => ({
      householdId: h._id,
      householdName: h.name,
      invitedAt: h.invites.find(inv => inv.email === user.email)?.invitedAt
    }));

    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Einladungen' });
  }
});

app.post('/api/households/:id/accept', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!household) {
      return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    }

    const invite = household.invites.find(inv => inv.email === user.email && inv.status === 'pending');
    if (!invite) {
      return res.status(404).json({ error: 'Einladung nicht gefunden' });
    }

    // Füge User zu Mitgliedern hinzu
    household.members.push(req.user.id);
    invite.status = 'accepted';
    await household.save();

    res.json({ message: 'Einladung angenommen', household });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Annehmen der Einladung' });
  }
});

app.post('/api/households/:id/decline', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    const user = await User.findById(req.user.id);

    if (!household) {
      return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    }

    const invite = household.invites.find(inv => inv.email === user.email && inv.status === 'pending');
    if (!invite) {
      return res.status(404).json({ error: 'Einladung nicht gefunden' });
    }

    invite.status = 'declined';
    await household.save();

    res.json({ message: 'Einladung abgelehnt' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Ablehnen der Einladung' });
  }
});

app.delete('/api/households/:householdId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.householdId);

    if (!household) {
      return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    }

    // Nur Creator oder das Mitglied selbst kann entfernen
    if (household.createdBy !== req.user.id && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Verhindere dass Creator sich selbst entfernt
    if (household.createdBy === req.params.userId) {
      return res.status(400).json({ error: 'Ersteller kann nicht entfernt werden' });
    }

    household.members = household.members.filter(m => m !== req.params.userId);
    await household.save();

    res.json({ message: 'Mitglied entfernt' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Entfernen des Mitglieds' });
  }
});

// Terminal Token Routes
app.post('/api/households/:id/terminal-token', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    if (!household) return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    if (!household.members.includes(req.user.id)) return res.status(403).json({ error: 'Keine Berechtigung' });

    const token = crypto.randomBytes(32).toString('hex');
    household.terminalToken = token;
    await household.save();

    res.json({ terminalToken: token });
  } catch (error) {
    console.error('Terminal Token Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Terminal-Tokens' });
  }
});

app.delete('/api/households/:id/terminal-token', authenticateToken, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    if (!household) return res.status(404).json({ error: 'Haushalt nicht gefunden' });
    if (!household.members.includes(req.user.id)) return res.status(403).json({ error: 'Keine Berechtigung' });

    household.terminalToken = null;
    await household.save();

    res.json({ message: 'Terminal-Token widerrufen' });
  } catch (error) {
    console.error('Terminal Token Widerruf Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Widerrufen des Terminal-Tokens' });
  }
});

app.get('/api/terminal/auth', authenticateTerminal, async (req, res) => {
  try {
    const household = req.terminalHousehold;
    const members = await User.find({ _id: { $in: household.members } }).select('name _id');

    res.json({
      household: {
        _id: household._id,
        name: household.name,
        memberDetails: members
      }
    });
  } catch (error) {
    console.error('Terminal Auth Fehler:', error);
    res.status(500).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
});

// Task Routes
app.get('/api/tasks', authenticateAny, async (req, res) => {
  try {
    const { householdId } = req.query;

    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe Berechtigung
    if (req.isTerminal) {
      if (req.terminalHousehold._id.toString() !== householdId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    } else {
      const household = await Household.findById(householdId);
      if (!household || !household.members.includes(req.user.id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    // Automatisches Archivieren: Erledigte Aufgaben älter als 14 Tage
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    await Task.updateMany(
      {
        householdId,
        completed: true,
        completedAt: { $lt: fourteenDaysAgo },
        archived: false
      },
      { $set: { archived: true } }
    );

    // Gebe nur nicht-archivierte Aufgaben zurück
    const tasks = await Task.find({ householdId, archived: { $ne: true } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Aufgaben' });
  }
});

// Kalender-Ansicht: Tasks in einem Datumsbereich
app.get('/api/tasks/calendar', authenticateToken, async (req, res) => {
  try {
    const { householdId, startDate, endDate } = req.query;

    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe ob User Mitglied ist
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Query für Tasks mit Deadline im angegebenen Bereich
    const query = { householdId };

    if (startDate || endDate) {
      query.deadline = {};
      if (startDate) query.deadline.$gte = new Date(startDate);
      if (endDate) query.deadline.$lte = new Date(endDate);
    }

    const tasks = await Task.find(query).sort({ deadline: 1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Kalender-Aufgaben' });
  }
});

// Archivierte Aufgaben abrufen
app.get('/api/tasks/archived', authenticateToken, async (req, res) => {
  try {
    const { householdId } = req.query;

    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe ob User Mitglied ist
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const tasks = await Task.find({ householdId, archived: true }).sort({ completedAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der archivierten Aufgaben' });
  }
});

// Statistiken: Erledigte Aufgaben pro Person
app.get('/api/tasks/statistics', authenticateToken, async (req, res) => {
  try {
    const { householdId, timeRange } = req.query; // timeRange: 'all', '7days', '30days'

    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe ob User Mitglied ist
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Berechne Zeitfilter basierend auf timeRange
    const matchQuery = {
      householdId,
      completed: true,
      completedBy: { $exists: true, $ne: null }
    };

    if (timeRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      matchQuery.completedAt = { $gte: sevenDaysAgo };
    } else if (timeRange === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      matchQuery.completedAt = { $gte: thirtyDaysAgo };
    }
    // Bei 'all' oder undefined: kein Zeitfilter

    // Aggregation: Zähle erledigte Aufgaben pro completedBy
    const stats = await Task.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: '$completedBy',
          count: { $sum: 1 }
        }
      }
    ]);

    // Hole User-Details für die IDs
    const userIds = stats.map(s => s._id);
    const users = await User.find({ _id: { $in: userIds } });

    const statistics = stats.map(stat => {
      const user = users.find(u => u._id.toString() === stat._id);
      return {
        userId: stat._id,
        userName: user ? user.name : 'Unbekannt',
        userEmail: user ? user.email : '',
        completedCount: stat.count
      };
    });

    // Sortiere nach Anzahl (absteigend)
    statistics.sort((a, b) => b.completedCount - a.completedCount);

    res.json(statistics);
  } catch (error) {
    console.error('Fehler bei Statistik:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

app.post('/api/tasks', authenticateAny, async (req, res) => {
  try {
    const { householdId } = req.body;

    // Prüfe Berechtigung
    let household;
    if (req.isTerminal) {
      if (req.terminalHousehold._id.toString() !== householdId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      household = req.terminalHousehold;
    } else {
      household = await Household.findById(householdId);
      if (!household || !household.members.includes(req.user.id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    const task = new Task({
      ...req.body,
      householdId
    });
    await task.save();

    // Push Notifications nur für reguläre Benutzer
    if (!req.isTerminal) {
      const creator = await User.findById(req.user.id);
      const category = await Category.findById(task.category);

      // 1. Benachrichtige alle anderen Mitglieder über neue Task
      const otherMembers = household.members.filter(m => m !== req.user.id);
      for (const memberId of otherMembers) {
        await sendPushNotification(
          memberId,
          'Neue Aufgabe',
          `${creator.name} hat "${task.title}" erstellt${category ? ` (${category.name})` : ''}`,
          { type: 'new_task', taskId: task._id.toString(), householdId }
        );
      }

      // 2. Zusätzlich: Wenn Task zugewiesen wurde (und nicht Selbstzuweisung)
      if (task.assignedTo && Array.isArray(task.assignedTo)) {
        for (const userId of task.assignedTo) {
          if (userId !== req.user.id) {
            const user = await User.findById(userId);
            if (user && user.notificationPreferences?.taskAssignments !== false) {
              await sendPushNotification(
                userId,
                'Dir wurde eine Aufgabe zugewiesen',
                `${creator.name} hat dir "${task.title}" zugewiesen`,
                { type: 'task_assigned', taskId: task._id.toString(), householdId }
              );
            }
          }
        }
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
  }
});

app.put('/api/tasks/:id', authenticateAny, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

    // Prüfe Berechtigung
    let household;
    if (req.isTerminal) {
      if (req.terminalHousehold._id.toString() !== task.householdId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      household = req.terminalHousehold;
    } else {
      household = await Household.findById(task.householdId);
      if (!household || !household.members.includes(req.user.id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    // Speichere alte Zuweisung für Notification-Vergleich
    const oldAssignedTo = task.assignedTo;

    // Wenn completed sich ändert, setze completedAt
    if (req.body.completed !== undefined && req.body.completed !== task.completed) {
      if (req.body.completed) {
        req.body.completedAt = new Date();
        if (req.isTerminal) {
          // Frontend übergibt completedBy (Mitglieds-ID); validieren dass es ein Haushaltsmitglied ist
          if (req.body.completedBy && !household.members.includes(req.body.completedBy)) {
            return res.status(400).json({ error: 'Ungültiges Mitglied' });
          }
          // req.body.completedBy bleibt wie übergeben
        } else {
          req.body.completedBy = req.user.id;
        }
      } else {
        req.body.completedAt = null;
        req.body.completedBy = null;
      }
    }

    Object.assign(task, req.body);
    await task.save();

    // Wiederkehrende Aufgaben: Erstelle neue Task wenn completed und recurrence aktiviert
    if (req.body.completed && task.recurrence && task.recurrence.enabled) {
      const calculateNextDeadline = (currentDeadline, frequency, interval) => {
        if (!currentDeadline) return null;
        const next = new Date(currentDeadline);

        switch (frequency) {
          case 'daily':
            next.setDate(next.getDate() + interval);
            break;
          case 'weekly':
            next.setDate(next.getDate() + (interval * 7));
            break;
          case 'monthly':
            next.setMonth(next.getMonth() + interval);
            break;
        }
        return next;
      };

      const nextDeadline = calculateNextDeadline(
        task.deadline,
        task.recurrence.frequency,
        task.recurrence.interval
      );

      // Erstelle neue wiederkehrende Task
      const newRecurringTask = new Task({
        householdId: task.householdId,
        title: task.title,
        category: task.category,
        deadline: nextDeadline,
        assignedTo: task.assignedTo,
        completed: false,
        priority: task.priority,
        description: task.description,
        recurrence: {
          enabled: true,
          frequency: task.recurrence.frequency,
          interval: task.recurrence.interval,
          lastRecurrence: new Date()
        }
      });
      await newRecurringTask.save();
      console.log(`✅ Wiederkehrende Aufgabe erstellt: "${task.title}" (neues Datum: ${nextDeadline})`);
    }

    // Push Notification bei Zuweisung (nur für reguläre Benutzer, nicht Terminal)
    if (!req.isTerminal && req.body.assignedTo !== undefined && Array.isArray(req.body.assignedTo)) {
      const oldAssignedSet = new Set(Array.isArray(oldAssignedTo) ? oldAssignedTo : []);
      const newAssignedUsers = req.body.assignedTo.filter(userId =>
        !oldAssignedSet.has(userId) && userId !== req.user.id
      );

      if (newAssignedUsers.length > 0) {
        const assigner = await User.findById(req.user.id);
        for (const userId of newAssignedUsers) {
          const user = await User.findById(userId);
          if (user && user.notificationPreferences?.taskAssignments !== false) {
            await sendPushNotification(
              userId,
              'Dir wurde eine Aufgabe zugewiesen',
              `${assigner.name} hat dir "${task.title}" zugewiesen`,
              { type: 'task_assigned', taskId: task._id.toString(), householdId: task.householdId }
            );
          }
        }
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Aufgabe' });
  }
});

app.delete('/api/tasks/:id', authenticateAny, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

    // Prüfe Berechtigung
    if (req.isTerminal) {
      if (req.terminalHousehold._id.toString() !== task.householdId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    } else {
      const household = await Household.findById(task.householdId);
      if (!household || !household.members.includes(req.user.id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Aufgabe gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen der Aufgabe' });
  }
});

// Category Routes
app.get('/api/categories', authenticateAny, async (req, res) => {
  try {
    const { householdId } = req.query;

    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe Berechtigung
    if (req.isTerminal) {
      if (req.terminalHousehold._id.toString() !== householdId) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    } else {
      const household = await Household.findById(householdId);
      if (!household || !household.members.includes(req.user.id)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    const categories = await Category.find({ householdId });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { householdId } = req.body;

    // Prüfe Berechtigung
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const category = new Category({
      ...req.body,
      householdId
    });
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    // Prüfe Berechtigung
    const household = await Household.findById(category.householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Aktualisiere Name und Farbe
    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.color !== undefined) category.color = req.body.color;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    // Prüfe Berechtigung
    const household = await Household.findById(category.householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Prüfe ob Kategorie verwendet wird
    const tasksUsingCategory = await Task.countDocuments({
      householdId: category.householdId,
      category: req.params.id
    });

    if (tasksUsingCategory > 0) {
      return res.status(400).json({ error: 'Kategorie wird noch verwendet' });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Kategorie gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Cron Job für Deadline-Benachrichtigungen
// Läuft alle 5 Minuten und prüft Tasks mit anstehenden/überfälligen Deadlines
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // 1. Finde Tasks die in der nächsten Stunde fällig sind (noch nicht benachrichtigt)
    const upcomingTasks = await Task.find({
      deadline: { $gte: now, $lte: oneHourLater },
      completed: false,
      hourNotified: false
    });

    for (const task of upcomingTasks) {
      if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        for (const userId of task.assignedTo) {
          // Prüfe ob Benutzer Deadline-Benachrichtigungen aktiviert hat
          const user = await User.findById(userId);
          if (user && user.notificationPreferences?.deadlineNotifications !== false) {
            await sendPushNotification(
              userId,
              'Aufgabe wird bald fällig!',
              `"${task.title}" ist in weniger als 1 Stunde fällig`,
              { type: 'deadline_soon', taskId: task._id.toString(), householdId: task.householdId }
            );
          }
        }
        task.hourNotified = true;
        await task.save();
      }
    }

    // 2. Finde überfällige Tasks (noch nicht benachrichtigt)
    const overdueTasks = await Task.find({
      deadline: { $lt: now },
      completed: false,
      overdueNotified: false
    });

    for (const task of overdueTasks) {
      if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        for (const userId of task.assignedTo) {
          // Prüfe ob Benutzer Deadline-Benachrichtigungen aktiviert hat
          const user = await User.findById(userId);
          if (user && user.notificationPreferences?.deadlineNotifications !== false) {
            await sendPushNotification(
              userId,
              'Aufgabe überfällig!',
              `"${task.title}" ist überfällig`,
              { type: 'deadline_overdue', taskId: task._id.toString(), householdId: task.householdId }
            );
          }
        }
        task.overdueNotified = true;
        await task.save();
      }
    }

    if (upcomingTasks.length > 0 || overdueTasks.length > 0) {
      console.log(`📅 Deadline-Check: ${upcomingTasks.length} bald fällig, ${overdueTasks.length} überfällig`);
    }
  } catch (error) {
    console.error('❌ Cron Job Fehler:', error);
  }
});

// Daily Task Reminder - Prüft jede Minute, ob Benutzer ihre tägliche Erinnerung erhalten sollen
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    // Finde alle Benutzer, die zu dieser Uhrzeit eine Erinnerung möchten
    const users = await User.find({
      'notificationPreferences.dailyTaskReminder': true,
      'notificationPreferences.reminderTime': currentTime,
      fcmToken: { $ne: null }
    });

    if (users.length === 0) {
      return; // Keine Benutzer für diese Uhrzeit
    }

    console.log(`⏰ Tägliche Erinnerung: ${users.length} Benutzer um ${currentTime}`);

    for (const user of users) {
      try {
        // Finde alle Haushalte des Benutzers
        const households = await Household.find({ members: user._id.toString() });

        let totalTodayTasks = 0;
        let totalOverdueTasks = 0;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Zähle nur dem Benutzer zugewiesene Aufgaben über alle Haushalte
        for (const household of households) {
          const todayTasks = await Task.countDocuments({
            householdId: household._id.toString(),
            completed: false,
            archived: false,
            assignedTo: user._id.toString(),
            deadline: { $gte: todayStart, $lte: todayEnd }
          });
          totalTodayTasks += todayTasks;

          const overdueTasks = await Task.countDocuments({
            householdId: household._id.toString(),
            completed: false,
            archived: false,
            assignedTo: user._id.toString(),
            deadline: { $lt: todayStart }
          });
          totalOverdueTasks += overdueTasks;
        }

        // Sende Benachrichtigung nur wenn es heutige oder überfällige Aufgaben gibt
        if (totalTodayTasks > 0 || totalOverdueTasks > 0) {
          const parts = [];
          if (totalTodayTasks > 0) {
            const taskWord = totalTodayTasks === 1 ? 'Aufgabe' : 'Aufgaben';
            parts.push(`${totalTodayTasks} ${taskWord} für heute`);
          }
          if (totalOverdueTasks > 0) {
            const overdueWord = totalOverdueTasks === 1 ? 'überfällige Aufgabe' : 'überfällige Aufgaben';
            parts.push(`${totalOverdueTasks} ${overdueWord}`);
          }
          await sendPushNotification(
            user._id.toString(),
            '📋 Heutige Aufgaben',
            `Du hast ${parts.join(' und ')}`,
            { type: 'daily_reminder', count: (totalTodayTasks + totalOverdueTasks).toString() }
          );
        }
      } catch (userError) {
        console.error(`❌ Fehler bei täglicher Erinnerung für User ${user._id}:`, userError);
      }
    }
  } catch (error) {
    console.error('❌ Cron Job Fehler (Tägliche Erinnerung):', error);
  }
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});