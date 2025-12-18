const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/haushaltsplaner', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB verbunden'))
.catch(err => console.error('❌ MongoDB Fehler:', err));

// Schemas
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  deadline: Date,
  completed: { type: Boolean, default: false },
  hourNotified: { type: Boolean, default: false },
  overdueNotified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
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

    // Prüfe ob User existiert
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    }

    // Hash Passwort
    const hashedPassword = await bcrypt.hash(password, 10);

    // Erstelle User
    const user = new User({
      name,
      email,
      password: hashedPassword
    });
    await user.save();

    // Erstelle Standard-Kategorien
    const defaultCategories = [
      { userId: user._id.toString(), name: 'Küche', color: '#ef4444' },
      { userId: user._id.toString(), name: 'Bad', color: '#3b82f6' },
      { userId: user._id.toString(), name: 'Wohnzimmer', color: '#10b981' }
    ];
    await Category.insertMany(defaultCategories);

    // Erstelle Token
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

    // Finde User
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Falsche Anmeldedaten' });
    }

    // Prüfe Passwort
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Falsche Anmeldedaten' });
    }

    // Erstelle Token
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

// Task Routes
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Aufgaben' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const task = new Task({
      ...req.body,
      userId: req.user.id
    });
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Aufgabe' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Aufgabe' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    res.json({ message: 'Aufgabe gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen der Aufgabe' });
  }
});

// Category Routes
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.user.id });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const category = new Category({
      ...req.body,
      userId: req.user.id
    });
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    // Prüfe ob Kategorie verwendet wird
    const tasksUsingCategory = await Task.countDocuments({
      userId: req.user.id,
      category: req.params.id
    });

    if (tasksUsingCategory > 0) {
      return res.status(400).json({ error: 'Kategorie wird noch verwendet' });
    }

    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!category) return res.status(404).json({ error: 'Kategorie nicht gefunden' });
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