const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

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
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  deadline: Date,
  completed: { type: Boolean, default: false },
  completedAt: Date,
  completedBy: String,
  hourNotified: { type: Boolean, default: false },
  overdueNotified: { type: Boolean, default: false },
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

// Task Routes
app.get('/api/tasks', authenticateToken, async (req, res) => {
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

    const tasks = await Task.find({ householdId });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Aufgaben' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { householdId } = req.body;

    // Prüfe ob User Mitglied ist
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const task = new Task({
      ...req.body,
      householdId
    });
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

    // Prüfe Berechtigung
    const household = await Household.findById(task.householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Wenn completed sich ändert, setze completedAt
    if (req.body.completed !== undefined && req.body.completed !== task.completed) {
      if (req.body.completed) {
        req.body.completedAt = new Date();
        req.body.completedBy = req.user.id;
      } else {
        req.body.completedAt = null;
        req.body.completedBy = null;
      }
    }

    Object.assign(task, req.body);
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Aufgabe' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

    // Prüfe Berechtigung
    const household = await Household.findById(task.householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Aufgabe gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen der Aufgabe' });
  }
});

// Category Routes
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { householdId } = req.query;
    
    if (!householdId) {
      return res.status(400).json({ error: 'householdId erforderlich' });
    }

    // Prüfe Berechtigung
    const household = await Household.findById(householdId);
    if (!household || !household.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
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

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});