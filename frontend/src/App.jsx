import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Check, X, Bell, User, LogOut, FolderPlus, Settings, Edit2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

// Backend API URL - Für lokale Entwicklung
const API_URL = 'http://localhost:3000/api';

const HouseholdPlanner = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', category: '', deadline: '' });
  const [newCategory, setNewCategory] = useState({ name: '', color: '#3b82f6' });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Lade Token aus localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
      setShowLogin(false);
      loadUserData(savedToken);
    }
  }, []);

  // Lade Aufgaben und Kategorien
  const loadUserData = async (authToken) => {
    try {
      const [tasksData, categoriesData] = await Promise.all([
        fetch(`${API_URL}/tasks`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/categories`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(r => r.json())
      ]);

      setTasks(tasksData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  // Benachrichtigungen aktivieren
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Benachrichtigung senden
  const sendNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '🏠' });
    }
  };

  // Überprüfe Deadlines
  useEffect(() => {
    if (!currentUser || tasks.length === 0) return;

    const checkDeadlines = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.completed || !task.deadline) return;

        const deadline = new Date(task.deadline);
        const timeUntilDeadline = deadline - now;
        const oneHour = 60 * 60 * 1000;

        if (timeUntilDeadline > 0 && timeUntilDeadline <= oneHour && !task.hourNotified) {
          sendNotification('Deadline bald!', `"${task.title}" endet in weniger als 1 Stunde!`);
          updateTask(task._id, { hourNotified: true });
        }

        if (timeUntilDeadline < 0 && !task.overdueNotified) {
          sendNotification('Deadline überschritten!', `"${task.title}" ist überfällig!`);
          updateTask(task._id, { overdueNotified: true });
        }
      });
    };

    const interval = setInterval(checkDeadlines, 60000);
    checkDeadlines();

    return () => clearInterval(interval);
  }, [tasks, currentUser]);

  // Login
  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login fehlgeschlagen');
      }

      const data = await response.json();
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setShowLogin(false);
      await loadUserData(data.token);
      await requestNotificationPermission();
    } catch (error) {
      alert(error.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Registrierung
  const handleRegister = async () => {
    if (!registerEmail || !registerPassword || !registerName) {
      alert('Bitte alle Felder ausfüllen!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registrierung fehlgeschlagen');
      }

      const data = await response.json();
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setShowLogin(false);
      await loadUserData(data.token);
      await requestNotificationPermission();
    } catch (error) {
      alert(error.message || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
    setShowLogin(true);
    setTasks([]);
    setCategories([]);
  };

  // Aufgabe hinzufügen
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.category) {
      alert('Bitte Titel und Kategorie angeben!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTask),
      });

      if (!response.ok) throw new Error('Fehler beim Erstellen');

      const task = await response.json();
      setTasks([...tasks, task]);
      setNewTask({ title: '', category: '', deadline: '' });
      setShowAddTask(false);
    } catch (error) {
      alert('Fehler beim Erstellen der Aufgabe');
    }
  };

  // Aufgabe bearbeiten öffnen
  const openEditTask = (task) => {
    setEditingTask({
      ...task,
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ''
    });
    setShowEditTask(true);
  };

  // Aufgabe bearbeiten speichern
  const handleEditTask = async () => {
    if (!editingTask.title || !editingTask.category) {
      alert('Bitte Titel und Kategorie angeben!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks/${editingTask._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editingTask.title,
          category: editingTask.category,
          deadline: editingTask.deadline
        }),
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      const updatedTask = await response.json();
      setTasks(tasks.map(t => t._id === updatedTask._id ? updatedTask : t));
      setShowEditTask(false);
      setEditingTask(null);
    } catch (error) {
      alert('Fehler beim Aktualisieren der Aufgabe');
    }
  };

  // Aufgabe aktualisieren
  const updateTask = async (taskId, updates) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      const updatedTask = await response.json();
      setTasks(tasks.map(t => t._id === taskId ? updatedTask : t));
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    }
  };

  // Aufgabe umschalten
  const toggleTask = async (task) => {
    await updateTask(task._id, { completed: !task.completed });
  };

  // Aufgabe löschen
  const deleteTask = async (taskId) => {
    if (!confirm('Möchtest du diese Aufgabe wirklich löschen?')) return;

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Fehler beim Löschen');

      setTasks(tasks.filter(t => t._id !== taskId));
    } catch (error) {
      alert('Fehler beim Löschen der Aufgabe');
    }
  };

  // Kategorie hinzufügen
  const handleAddCategory = async () => {
    if (!newCategory.name) {
      alert('Bitte Namen angeben!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCategory),
      });

      if (!response.ok) throw new Error('Fehler beim Erstellen');

      const category = await response.json();
      setCategories([...categories, category]);
      setNewCategory({ name: '', color: '#3b82f6' });
      setShowAddCategory(false);
    } catch (error) {
      alert('Fehler beim Erstellen der Kategorie');
    }
  };

  // Kategorie löschen
  const deleteCategory = async (categoryId) => {
    if (!confirm('Möchtest du diese Kategorie wirklich löschen?')) return;

    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Löschen');
      }

      setCategories(categories.filter(c => c._id !== categoryId));
    } catch (error) {
      alert(error.message || 'Fehler beim Löschen der Kategorie');
    }
  };

  // Deadline-Status
  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;
    const oneHour = 60 * 60 * 1000;

    if (diff < 0) return 'overdue';
    if (diff <= oneHour) return 'soon';
    return 'ok';
  };

  // Gefilterte und sortierte Aufgaben
  const filteredTasks = selectedCategory === 'all' 
    ? tasks 
    : tasks.filter(task => task.category === selectedCategory);

  // Trenne aktive und erledigte Aufgaben
  const activeTasks = filteredTasks.filter(task => !task.completed);
  const completedTasks = filteredTasks.filter(task => task.completed);

  // Sortiere aktive Aufgaben: Überfällig zuerst, dann nach Deadline
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const statusA = getDeadlineStatus(a.deadline);
    const statusB = getDeadlineStatus(b.deadline);

    // Überfällige Aufgaben zuerst
    if (statusA === 'overdue' && statusB !== 'overdue') return -1;
    if (statusA !== 'overdue' && statusB === 'overdue') return 1;

    // Dann nach Deadline sortieren
    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    return 0;
  });

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-indigo-100 rounded-full mb-4">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Haushaltsplaner</h1>
            <p className="text-gray-600 mt-2">
              {isRegistering ? 'Neues Konto erstellen' : 'Willkommen zurück'}
            </p>
          </div>

          {!isRegistering ? (
            <div className="space-y-4">
              <input
                type="email"
                placeholder="E-Mail"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Lädt...' : 'Anmelden'}
              </button>
              <button
                onClick={() => setIsRegistering(true)}
                className="w-full text-indigo-600 py-2 hover:text-indigo-700 transition-colors"
              >
                Noch kein Konto? Registrieren
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Lädt...' : 'Registrieren'}
              </button>
              <button
                onClick={() => setIsRegistering(false)}
                className="w-full text-indigo-600 py-2 hover:text-indigo-700 transition-colors"
              >
                Zurück zur Anmeldung
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Haushaltsplaner</h1>
              <p className="text-sm text-gray-600">Hallo, {currentUser?.name}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Einstellungen</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Kategorien</h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Alle ({tasks.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat._id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === cat._id
                    ? 'text-white'
                    : 'text-gray-700 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === cat._id ? cat.color : `${cat.color}40`
                }}
              >
                {cat.name} ({tasks.filter(t => t.category === cat._id).length})
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddTask(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Neue Aufgabe hinzufügen
          </button>
        </div>

        {/* Einstellungen Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Einstellungen</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-800">Kategorien verwalten</h4>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Neue Kategorie
                  </button>
                </div>

                <div className="space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Keine Kategorien vorhanden</p>
                  ) : (
                    categories.map(cat => (
                      <div
                        key={cat._id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-medium text-gray-800">{cat.name}</span>
                          <span className="text-sm text-gray-500">
                            ({tasks.filter(t => t.category === cat._id).length} Aufgaben)
                          </span>
                        </div>
                        <button
                          onClick={() => deleteCategory(cat._id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Konto</h4>
                <div className="space-y-2">
                  <p className="text-gray-600"><strong>Name:</strong> {currentUser?.name}</p>
                  <p className="text-gray-600"><strong>E-Mail:</strong> {currentUser?.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Neue Kategorie Modal */}
        {showAddCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Neue Kategorie</h3>
              <input
                type="text"
                placeholder="Kategoriename"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  className="w-full h-12 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCategory}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategory({ name: '', color: '#3b82f6' });
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Neue Aufgabe Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Neue Aufgabe</h3>
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              >
                <option value="">Kategorie wählen</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddTask}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                >
                  Hinzufügen
                </button>
                <button
                  onClick={() => {
                    setShowAddTask(false);
                    setNewTask({ title: '', category: '', deadline: '' });
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aufgabe bearbeiten Modal */}
        {showEditTask && editingTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Aufgabe bearbeiten</h3>
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <select
                value={editingTask.category}
                onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              >
                <option value="">Kategorie wählen</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={editingTask.deadline}
                onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditTask}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setShowEditTask(false);
                    setEditingTask(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aufgabenliste */}
        <div className="space-y-6">
          {/* Aktive Aufgaben */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Aktive Aufgaben ({activeTasks.length})
            </h2>
            {sortedActiveTasks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Keine aktiven Aufgaben</p>
                <p className="text-gray-400 text-sm mt-2">Gut gemacht! 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedActiveTasks.map(task => {
                  const category = categories.find(cat => cat._id === task.category);
                  const deadlineStatus = getDeadlineStatus(task.deadline);
                  const isOverdue = deadlineStatus === 'overdue';
                  
                  return (
                    <div
                      key={task._id}
                      className={`bg-white rounded-xl shadow-md p-4 transition-all ${
                        isOverdue ? 'border-2 border-red-500 bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isOverdue && (
                          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1 animate-pulse" />
                        )}
                        
                        <button
                          onClick={() => toggleTask(task)}
                          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {task.completed && <Check className="w-4 h-4 text-white" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium ${isOverdue ? 'text-red-700 font-bold' : 'text-gray-800'}`}>
                            {task.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {category && (
                              <span
                                className="px-3 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: category.color }}
                              >
                                {category.name}
                              </span>
                            )}
                            {task.deadline && (
                              <div className="flex items-center gap-1 text-xs">
                                <Bell className={`w-3 h-3 ${
                                  deadlineStatus === 'overdue' ? 'text-red-500' :
                                  deadlineStatus === 'soon' ? 'text-orange-500' : 'text-gray-600'
                                }`} />
                                <span className={
                                  deadlineStatus === 'overdue' ? 'text-red-500 font-bold' :
                                  deadlineStatus === 'soon' ? 'text-orange-500 font-medium' : 'text-gray-600'
                                }>
                                  {new Date(task.deadline).toLocaleString('de-DE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {isOverdue && ' - ÜBERFÄLLIG!'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditTask(task)}
                            className="flex-shrink-0 p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task._id)}
                            className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Erledigte Aufgaben */}
          {completedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center justify-between w-full text-left mb-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-bold text-gray-800">
                  Erledigte Aufgaben ({completedTasks.length})
                </h2>
                {showCompleted ? (
                  <ChevronUp className="w-6 h-6 text-gray-600" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600" />
                )}
              </button>

              {showCompleted && (
                <div className="space-y-3">
                  {completedTasks.map(task => {
                    const category = categories.find(cat => cat._id === task.category);
                    
                    return (
                      <div
                        key={task._id}
                        className="bg-white rounded-xl shadow-md p-4 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleTask(task)}
                            className="mt-1 flex-shrink-0 w-6 h-6 rounded-md border-2 bg-green-500 border-green-500 flex items-center justify-center transition-colors"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-800 line-through">
                              {task.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {category && (
                                <span
                                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: category.color }}
                                >
                                  {category.name}
                                </span>
                              )}
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Bell className="w-3 h-3" />
                                  <span>
                                    {new Date(task.deadline).toLocaleString('de-DE', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditTask(task)}
                              className="flex-shrink-0 p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deleteTask(task._id)}
                              className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HouseholdPlanner;