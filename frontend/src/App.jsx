import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Check, X, Bell, User, LogOut, FolderPlus, Settings, Edit2, AlertCircle, ChevronDown, ChevronUp, Users, Mail, Home, RefreshCw } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// Backend API URL - Für lokale Entwicklung
const API_URL = 'https://backend.app.mr-dk.de/api';

export default function HouseholdPlanner() {
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [households, setHouseholds] = useState([]);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    category: '',
    deadline: '',
    assignedTo: [],
    recurrence: { enabled: false, frequency: 'weekly', interval: 1 }
  });
  const [newCategory, setNewCategory] = useState({ name: '', color: '#3b82f6' });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // 'all', 'mine', 'unassigned'

  // Lade Token aus localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
      setShowLogin(false);
      loadHouseholds(savedToken);
      loadInvites(savedToken);
    }
  }, []);

  // Dark Mode aus localStorage laden
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Dark Mode in localStorage speichern und auf document anwenden
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Push Notifications Setup
  useEffect(() => {
    const initPushNotifications = async () => {
      // Nur auf nativen Plattformen (Android/iOS)
      if (!Capacitor.isNativePlatform()) {
        console.log('Push Notifications nur auf nativen Plattformen verfügbar');
        return;
      }

      if (!token) {
        return; // Warte bis User eingeloggt ist
      }

      try {
        // Prüfe Permission Status
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          // Frage nach Permission
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('Push Notification Permission verweigert');
          return;
        }

        // Registriere für Push Notifications
        await PushNotifications.register();

        // Listener für erfolgreiche Registrierung
        await PushNotifications.addListener('registration', async (tokenData) => {
          console.log('✅ FCM Token erhalten:', tokenData.value);

          // Sende Token an Backend
          try {
            await fetch(`${API_URL}/user/fcm-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ fcmToken: tokenData.value })
            });
            console.log('✅ FCM Token an Backend gesendet');
          } catch (error) {
            console.error('❌ Fehler beim Senden des FCM Tokens:', error);
          }
        });

        // Listener für Registrierungs-Fehler
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ Push Notification Registrierung fehlgeschlagen:', error);
        });

        // Listener für empfangene Notifications (App im Vordergrund)
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('📬 Push Notification empfangen:', notification);
          // Zeige Notification im Frontend (optional)
        });

        // Listener für geklickte Notifications
        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('🔔 Notification geklickt:', notification);
          // Navigation basierend auf notification.data möglich
        });

      } catch (error) {
        console.error('❌ Push Notification Setup fehlgeschlagen:', error);
      }
    };

    initPushNotifications();

    // Cleanup
    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [token]);

  // Lade Haushalte
  const loadHouseholds = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/households`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setHouseholds(data);
      
      // Wähle ersten Haushalt automatisch
      if (data.length > 0) {
        const savedHouseholdId = localStorage.getItem('selectedHousehold');
        const household = data.find(h => h._id === savedHouseholdId) || data[0];
        setSelectedHousehold(household);
        loadHouseholdData(household._id, authToken);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Haushalte:', error);
    }
  };

  // Lade Einladungen
  const loadInvites = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/households/invites`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setPendingInvites(data);
    } catch (error) {
      console.error('Fehler beim Laden der Einladungen:', error);
    }
  };

  // Lade Haushaltsdaten
  const loadHouseholdData = async (householdId, authToken) => {
    try {
      const [tasksData, categoriesData] = await Promise.all([
        fetch(`${API_URL}/tasks?householdId=${householdId}`, {
          headers: { 'Authorization': `Bearer ${authToken || token}` }
        }).then(r => r.json()),
        fetch(`${API_URL}/categories?householdId=${householdId}`, {
          headers: { 'Authorization': `Bearer ${authToken || token}` }
        }).then(r => r.json())
      ]);

      console.log('📥 Geladene Tasks vom Backend:', tasksData.length, 'Tasks');
      const tasksWithAssignment = tasksData.filter(t => t.assignedTo);
      console.log('   - Tasks mit Zuweisung:', tasksWithAssignment.length);
      if (tasksWithAssignment.length > 0) {
        console.log('   - Beispiel:', tasksWithAssignment[0].title, '→', tasksWithAssignment[0].assignedTo);
      }

      setTasks(tasksData);
      setCategories(categoriesData);
      localStorage.setItem('selectedHousehold', householdId);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  // Manuelle Aktualisierung
  const refreshData = async () => {
    if (!selectedHousehold || !token) return;

    setIsRefreshing(true);
    try {
      await loadHouseholdData(selectedHousehold._id, token);
      await loadHouseholds(token);
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Kurzes Feedback
    }
  };

  // Auto-Refresh alle 10 Sekunden
  useEffect(() => {
    if (!selectedHousehold || !token) return;

    const intervalId = setInterval(() => {
      loadHouseholdData(selectedHousehold._id, token);
    }, 10000); // 10 Sekunden

    return () => clearInterval(intervalId);
  }, [selectedHousehold, token]);

  // Haushalt wechseln
  const switchHousehold = (household) => {
    setSelectedHousehold(household);
    loadHouseholdData(household._id, token);
  };

  // Gemeinsamen Haushalt erstellen
  const createSharedHousehold = async () => {
    const name = prompt('Name des gemeinsamen Haushalts:');
    if (!name || !name.trim()) return;

    try {
      const response = await fetch(`${API_URL}/households`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), isPrivate: false })
      });

      if (!response.ok) throw new Error('Fehler beim Erstellen');

      const newHousehold = await response.json();
      await loadHouseholds(token);
      switchHousehold(newHousehold);
      alert('Gemeinsamer Haushalt erstellt! Du kannst jetzt andere Personen einladen.');
    } catch (error) {
      alert('Fehler beim Erstellen des Haushalts');
    }
  };

  // Einladung annehmen
  const acceptInvite = async (householdId) => {
    try {
      await fetch(`${API_URL}/households/${householdId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      await loadHouseholds(token);
      await loadInvites(token);
      alert('Einladung angenommen!');
    } catch (error) {
      alert('Fehler beim Annehmen der Einladung');
    }
  };

  // Einladung ablehnen
  const declineInvite = async (householdId) => {
    try {
      await fetch(`${API_URL}/households/${householdId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      await loadInvites(token);
      alert('Einladung abgelehnt');
    } catch (error) {
      alert('Fehler beim Ablehnen der Einladung');
    }
  };

  // Benutzer einladen
  const handleInvite = async () => {
    if (!inviteEmail) {
      alert('Bitte E-Mail-Adresse eingeben!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/households/${selectedHousehold._id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      alert('Einladung versendet!');
      setInviteEmail('');
      setShowInviteModal(false);
      await loadHouseholds(token);
    } catch (error) {
      alert(error.message || 'Fehler beim Versenden der Einladung');
    }
  };

  // Mitglied entfernen
  const removeMember = async (userId) => {
    if (!confirm('Möchtest du dieses Mitglied wirklich entfernen?')) return;

    try {
      await fetch(`${API_URL}/households/${selectedHousehold._id}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      await loadHouseholds(token);
      alert('Mitglied entfernt');
    } catch (error) {
      alert('Fehler beim Entfernen des Mitglieds');
    }
  };

  // Haushalt löschen
  const deleteHousehold = async () => {
    if (!confirm(`Möchtest du den Haushalt "${selectedHousehold.name}" wirklich dauerhaft löschen? Alle Aufgaben und Kategorien werden ebenfalls gelöscht. Dies kann nicht rückgängig gemacht werden!`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/households/${selectedHousehold._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Fehler beim Löschen des Haushalts');
        return;
      }

      // Schließe Einstellungen
      setShowSettings(false);

      // Lade Haushalte neu
      await loadHouseholds(token);

      // Wähle ersten verfügbaren Haushalt aus
      const updatedHouseholds = await fetch(`${API_URL}/households`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());

      if (updatedHouseholds.length > 0) {
        setSelectedHousehold(updatedHouseholds[0]);
        await loadHouseholdData(updatedHouseholds[0]._id, token);
      }

      alert('Haushalt erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Haushalts');
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
      await loadHouseholds(data.token);
      await loadInvites(data.token);
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
      await loadHouseholds(data.token);
      await loadInvites(data.token);
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
    localStorage.removeItem('selectedHousehold');
    setToken(null);
    setCurrentUser(null);
    setShowLogin(true);
    setTasks([]);
    setCategories([]);
    setHouseholds([]);
  };

  // Hilfsfunktion: datetime-local zu ISO String (mit korrekter Zeitzone)
  const localToUTC = (datetimeLocal) => {
    if (!datetimeLocal) return null;
    // datetime-local Format: "2024-01-15T10:00"
    // new Date interpretiert das als lokale Zeit und konvertiert korrekt zu UTC
    const date = new Date(datetimeLocal);
    return date.toISOString();
  };

  // Hilfsfunktion: ISO String zu datetime-local Format (mit korrekter Zeitzone)
  const utcToLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // datetime-local benötigt Format: "2024-01-15T10:00" in lokaler Zeit
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Hilfsfunktion: Formatiere Datum für Anzeige
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Nutze lokale Zeit für Anzeige
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  // Aufgabe hinzufügen
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.category) {
      alert('Bitte Titel und Kategorie angeben!');
      return;
    }

    try {
      const taskData = {
        title: newTask.title,
        category: newTask.category,
        householdId: selectedHousehold._id,
        deadline: localToUTC(newTask.deadline),
        assignedTo: newTask.assignedTo,
        recurrence: newTask.recurrence
      };

      console.log('📤 Sende neue Task mit assignedTo:', taskData.assignedTo);

      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) throw new Error('Fehler beim Erstellen');

      const task = await response.json();
      console.log('📥 Empfangene Task vom Backend:', task);
      console.log('   - assignedTo:', task.assignedTo);

      setTasks([...tasks, task]);
      setNewTask({
        title: '',
        category: '',
        deadline: '',
        assignedTo: [],
        recurrence: { enabled: false, frequency: 'weekly', interval: 1 }
      });
      setShowAddTask(false);
    } catch (error) {
      alert('Fehler beim Erstellen der Aufgabe');
    }
  };

  // Aufgabe bearbeiten öffnen
  const openEditTask = (task) => {
    setEditingTask({
      ...task,
      deadline: utcToLocal(task.deadline),
      assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      recurrence: task.recurrence || { enabled: false, frequency: 'weekly', interval: 1 }
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
      const updates = {
        title: editingTask.title,
        category: editingTask.category,
        deadline: localToUTC(editingTask.deadline),
        assignedTo: editingTask.assignedTo,
        recurrence: editingTask.recurrence
      };

      console.log('📤 Update Task mit assignedTo:', updates.assignedTo);

      const response = await fetch(`${API_URL}/tasks/${editingTask._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      const updatedTask = await response.json();
      console.log('📥 Empfangene aktualisierte Task:', updatedTask);
      console.log('   - assignedTo:', updatedTask.assignedTo);

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
        body: JSON.stringify({
          ...newCategory,
          householdId: selectedHousehold._id
        }),
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

  // Kategorie bearbeiten
  const handleEditCategory = async () => {
    if (!editingCategory.name) {
      alert('Bitte Namen angeben!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/categories/${editingCategory._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingCategory.name,
          color: editingCategory.color
        }),
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      const updatedCategory = await response.json();
      setCategories(categories.map(cat => cat._id === updatedCategory._id ? updatedCategory : cat));
      setEditingCategory(null);
      setShowEditCategory(false);
    } catch (error) {
      alert('Fehler beim Aktualisieren der Kategorie');
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
  let filteredTasks = selectedCategory === 'all'
    ? tasks
    : tasks.filter(task => task.category === selectedCategory);

  // Filter nach Zuweisung
  if (assignmentFilter === 'mine') {
    filteredTasks = filteredTasks.filter(task => task.assignedTo === currentUser?.id);
  } else if (assignmentFilter === 'unassigned') {
    filteredTasks = filteredTasks.filter(task => !task.assignedTo);
  }

  // Trenne aktive und erledigte Aufgaben
  const activeTasks = filteredTasks.filter(task => !task.completed);
  const completedTasks = filteredTasks.filter(task => task.completed);

  // Sortiere aktive Aufgaben: Überfällig zuerst, dann nach Deadline
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const statusA = getDeadlineStatus(a.deadline);
    const statusB = getDeadlineStatus(b.deadline);

    if (statusA === 'overdue' && statusB !== 'overdue') return -1;
    if (statusA !== 'overdue' && statusB === 'overdue') return 1;

    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    return 0;
  });

  // Hilfsfunktion: Name des Benutzers der Aufgabe erledigt hat
  const getCompletedByName = (userId) => {
    if (!selectedHousehold) return '';
    const member = selectedHousehold.memberDetails?.find(m => m._id === userId);
    return member ? member.name : 'Unbekannt';
  };

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

  if (!selectedHousehold) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Lade Haushalt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{selectedHousehold.name}</h1>
                <p className="text-sm text-gray-600">Hallo, {currentUser?.name}!</p>
              </div>
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className={`p-2 rounded-lg transition-all ${
                  isRefreshing
                    ? 'text-indigo-600 animate-spin'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title="Aktualisieren (automatisch alle 10 Sek.)"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {pendingInvites.length > 0 && (
                <div className="relative">
                  <Mail className="w-6 h-6 text-indigo-600" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingInvites.length}
                  </span>
                </div>
              )}
              <button
                onClick={createSharedHousehold}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Gemeinsamen Haushalt erstellen"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="hidden sm:inline">Gemeinsam</span>
              </button>
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

          {/* Haushalt-Wechsler */}
          {households.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {households.map(h => (
                <button
                  key={h._id}
                  onClick={() => switchHousehold(h)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedHousehold._id === h._id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  {h.name}
                  {h.isPrivate && (
                    <span className="text-xs opacity-75">🔒</span>
                  )}
                  {!h.isPrivate && (
                    <span className="text-xs opacity-75">({h.members.length})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Einladungsbenachrichtigungen */}
          {pendingInvites.length > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-2">
                📨 Du hast {pendingInvites.length} neue Einladung(en)
              </p>
              {pendingInvites.map(invite => (
                <div key={invite.householdId} className="flex items-center justify-between bg-white rounded p-3 mb-2">
                  <span className="text-gray-800">{invite.householdName}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptInvite(invite.householdId)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Annehmen
                    </button>
                    <button
                      onClick={() => declineInvite(invite.householdId)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          {selectedHousehold && !selectedHousehold.isPrivate && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Zuweisung</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAssignmentFilter('all')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Alle
                </button>
                <button
                  onClick={() => setAssignmentFilter('mine')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'mine'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Meine Aufgaben
                </button>
                <button
                  onClick={() => setAssignmentFilter('unassigned')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'unassigned'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Nicht zugewiesen
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowAddTask(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Neue Aufgabe hinzufügen
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mt-3"
          >
            <Calendar className="w-5 h-5" />
            Kalenderansicht
          </button>
        </div>

        {/* Einstellungen Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-8">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Einstellungen</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Haushaltsmitglieder */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {selectedHousehold.isPrivate ? 'Privater Haushalt 🔒' : `Mitglieder (${selectedHousehold.members.length})`}
                  </h4>
                  {!selectedHousehold.isPrivate && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Einladen
                    </button>
                  )}
                </div>

                {selectedHousehold.isPrivate && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Privater Haushalt:</strong> Dieser Haushalt ist nur für dich. Um Aufgaben mit anderen zu teilen, erstelle einen gemeinsamen Haushalt über den grünen "Gemeinsam"-Button oben.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedHousehold.memberDetails?.map(member => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        {member._id === selectedHousehold.createdBy && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mt-1 inline-block">
                            Ersteller
                          </span>
                        )}
                      </div>
                      {member._id !== selectedHousehold.createdBy && (
                        <button
                          onClick={() => removeMember(member._id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Ausstehende Einladungen */}
                {selectedHousehold.invites?.filter(inv => inv.status === 'pending').length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Ausstehende Einladungen:</p>
                    {selectedHousehold.invites
                      .filter(inv => inv.status === 'pending')
                      .map((inv, idx) => (
                        <div key={idx} className="text-sm text-gray-500 bg-yellow-50 p-2 rounded mb-1">
                          📧 {inv.email} - Eingeladen am {new Date(inv.invitedAt).toLocaleDateString('de-DE')}
                        </div>
                      ))}
                  </div>
                )}

                {/* Haushalt löschen - nur für gemeinsame Haushalte */}
                {!selectedHousehold.isPrivate && selectedHousehold.members.length === 1 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 mb-3">
                      <strong>Achtung:</strong> Du bist das einzige Mitglied in diesem Haushalt. Du kannst ihn jetzt löschen.
                    </p>
                    <button
                      onClick={deleteHousehold}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Haushalt dauerhaft löschen
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t pt-6 mb-6">
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setShowEditCategory(true);
                            }}
                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteCategory(cat._id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Darstellung</h4>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">Dark Mode</p>
                    <p className="text-sm text-gray-500">Dunkles Farbschema aktivieren</p>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      darkMode ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        darkMode ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
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

        {/* Einladungs-Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Benutzer einladen</h3>
              <p className="text-gray-600 text-sm mb-4">
                Gib die E-Mail-Adresse des Benutzers ein, den du zu "{selectedHousehold.name}" einladen möchtest.
              </p>
              <input
                type="email"
                placeholder="E-Mail-Adresse"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleInvite}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Einladen
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kategorie bearbeiten Modal */}
        {showEditCategory && editingCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Kategorie bearbeiten</h3>
              <input
                type="text"
                placeholder="Kategoriename"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Farbe</label>
                <input
                  type="color"
                  value={editingCategory.color}
                  onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                  className="w-full h-12 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditCategory}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setShowEditCategory(false);
                    setEditingCategory(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Neue Kategorie Modal */}
        {showAddCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-4">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-4">
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
              {selectedHousehold && !selectedHousehold.isPrivate && (
                <div className="mb-4 p-3 border border-gray-300 rounded-lg">
                  <p className="font-medium text-gray-700 mb-2">Zugewiesen an:</p>
                  {selectedHousehold.memberDetails?.map(member => (
                    <label key={member._id} className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTask.assignedTo.includes(member._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTask({ ...newTask, assignedTo: [...newTask.assignedTo, member._id] });
                          } else {
                            setNewTask({ ...newTask, assignedTo: newTask.assignedTo.filter(id => id !== member._id) });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">{member.name} ({member.email})</span>
                    </label>
                  ))}
                  {newTask.assignedTo.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Niemand zugewiesen</p>
                  )}
                </div>
              )}

              {/* Wiederkehrende Aufgabe */}
              <div className="mb-4 p-3 border border-gray-300 rounded-lg">
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={newTask.recurrence.enabled}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      recurrence: { ...newTask.recurrence, enabled: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">Wiederkehrende Aufgabe</span>
                </label>
                {newTask.recurrence.enabled && (
                  <div className="mt-2 space-y-2">
                    <select
                      value={newTask.recurrence.frequency}
                      onChange={(e) => setNewTask({
                        ...newTask,
                        recurrence: { ...newTask.recurrence, frequency: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Alle</span>
                      <input
                        type="number"
                        min="1"
                        value={newTask.recurrence.interval}
                        onChange={(e) => setNewTask({
                          ...newTask,
                          recurrence: { ...newTask.recurrence, interval: parseInt(e.target.value) || 1 }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600">
                        {newTask.recurrence.frequency === 'daily' ? 'Tag(e)' :
                         newTask.recurrence.frequency === 'weekly' ? 'Woche(n)' : 'Monat(e)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

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
                    setNewTask({
                      title: '',
                      category: '',
                      deadline: '',
                      assignedTo: '',
                      recurrence: { enabled: false, frequency: 'weekly', interval: 1 }
                    });
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white rounded-xl p-6 w-full max-w-md my-4">
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
              {selectedHousehold && !selectedHousehold.isPrivate && (
                <div className="mb-4 p-3 border border-gray-300 rounded-lg">
                  <p className="font-medium text-gray-700 mb-2">Zugewiesen an:</p>
                  {selectedHousehold.memberDetails?.map(member => (
                    <label key={member._id} className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTask.assignedTo?.includes(member._id) || false}
                        onChange={(e) => {
                          const currentAssigned = editingTask.assignedTo || [];
                          if (e.target.checked) {
                            setEditingTask({ ...editingTask, assignedTo: [...currentAssigned, member._id] });
                          } else {
                            setEditingTask({ ...editingTask, assignedTo: currentAssigned.filter(id => id !== member._id) });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">{member.name} ({member.email})</span>
                    </label>
                  ))}
                  {(!editingTask.assignedTo || editingTask.assignedTo.length === 0) && (
                    <p className="text-sm text-gray-500 italic">Niemand zugewiesen</p>
                  )}
                </div>
              )}

              {/* Wiederkehrende Aufgabe */}
              <div className="mb-4 p-3 border border-gray-300 rounded-lg">
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={editingTask.recurrence?.enabled || false}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      recurrence: {
                        ...editingTask.recurrence,
                        enabled: e.target.checked,
                        frequency: editingTask.recurrence?.frequency || 'weekly',
                        interval: editingTask.recurrence?.interval || 1
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">Wiederkehrende Aufgabe</span>
                </label>
                {editingTask.recurrence?.enabled && (
                  <div className="mt-2 space-y-2">
                    <select
                      value={editingTask.recurrence.frequency}
                      onChange={(e) => setEditingTask({
                        ...editingTask,
                        recurrence: { ...editingTask.recurrence, frequency: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Alle</span>
                      <input
                        type="number"
                        min="1"
                        value={editingTask.recurrence.interval}
                        onChange={(e) => setEditingTask({
                          ...editingTask,
                          recurrence: { ...editingTask.recurrence, interval: parseInt(e.target.value) || 1 }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600">
                        {editingTask.recurrence.frequency === 'daily' ? 'Tag(e)' :
                         editingTask.recurrence.frequency === 'weekly' ? 'Woche(n)' : 'Monat(e)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

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

        {/* Kalenderansicht Modal */}
        {showCalendar && selectedHousehold && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-8">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl my-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Kalenderansicht</h3>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {(() => {
                  // Gruppiere Tasks nach Datum
                  const tasksByDate = {};
                  const today = new Date();
                  const nextDays = 14; // Zeige nächsten 14 Tage

                  // Initialisiere die nächsten 14 Tage
                  for (let i = 0; i < nextDays; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() + i);
                    const dateKey = date.toISOString().split('T')[0];
                    tasksByDate[dateKey] = [];
                  }

                  // Füge Tasks zu den entsprechenden Daten hinzu
                  tasks.filter(task => task.deadline && !task.completed).forEach(task => {
                    const taskDate = new Date(task.deadline).toISOString().split('T')[0];
                    if (tasksByDate[taskDate]) {
                      tasksByDate[taskDate].push(task);
                    }
                  });

                  return Object.entries(tasksByDate).map(([dateKey, dateTasks]) => {
                    const date = new Date(dateKey);
                    const isToday = dateKey === today.toISOString().split('T')[0];
                    const dayName = date.toLocaleDateString('de-DE', { weekday: 'long' });
                    const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    return (
                      <div key={dateKey} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`px-3 py-1 rounded-lg ${isToday ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                            <span className="font-bold">{dayName}</span>
                            <span className="ml-2 text-sm">{dateStr}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {dateTasks.length} {dateTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                          </span>
                        </div>

                        {dateTasks.length === 0 ? (
                          <p className="text-gray-400 text-sm italic ml-2">Keine Aufgaben</p>
                        ) : (
                          <div className="space-y-2">
                            {dateTasks.map(task => {
                              const category = categories.find(cat => cat._id === task.category);
                              const assignedNames = task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0
                                ? task.assignedTo.map(userId =>
                                    selectedHousehold.memberDetails?.find(m => m._id === userId)?.name || 'Unbekannt'
                                  ).join(', ')
                                : null;
                              const taskTime = new Date(task.deadline).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit'
                              });

                              return (
                                <div
                                  key={task._id}
                                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  onClick={() => openEditTask(task)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category?.color || '#6B7280' }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-800">{task.title}</div>
                                    <div className="text-sm text-gray-500">
                                      {taskTime}
                                      {category && ` • ${category.name}`}
                                      {assignedNames && ` • ${assignedNames}`}
                                      {task.recurrence?.enabled && ' • 🔄'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
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
                                  {formatDate(task.deadline)}
                                  {isOverdue && ' - ÜBERFÄLLIG!'}
                                </span>
                              </div>
                            )}
                            {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                              <div className="flex items-center gap-1 text-xs text-indigo-600">
                                <Users className="w-3 h-3" />
                                <span>
                                  {task.assignedTo.map(userId =>
                                    selectedHousehold.memberDetails.find(m => m._id === userId)?.name || 'Unbekannt'
                                  ).join(', ')}
                                </span>
                              </div>
                            )}
                            {task.recurrence?.enabled && (
                              <div className="flex items-center gap-1 text-xs text-green-600" title="Wiederkehrende Aufgabe">
                                <RefreshCw className="w-3 h-3" />
                                <span>
                                  {task.recurrence.frequency === 'daily' ? 'Täglich' :
                                   task.recurrence.frequency === 'weekly' ? 'Wöchentlich' : 'Monatlich'}
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
                              {task.completedAt && (
                                <span className="text-xs text-gray-600">
                                  ✅ Erledigt am {formatDate(task.completedAt)}
                                  {task.completedBy && ` von ${getCompletedByName(task.completedBy)}`}
                                </span>
                              )}
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Bell className="w-3 h-3" />
                                  <span>
                                    Frist: {formatDate(task.deadline)}
                                  </span>
                                </div>
                              )}
                              {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600">
                                  <Users className="w-3 h-3" />
                                  <span>
                                    {task.assignedTo.map(userId =>
                                      selectedHousehold.memberDetails.find(m => m._id === userId)?.name || 'Unbekannt'
                                    ).join(', ')}
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
}