import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Check, X, Bell, User, LogOut, FolderPlus, Settings, Edit2, AlertCircle, ChevronDown, ChevronUp, Users, Mail, Home, RefreshCw, Archive, BarChart, CheckSquare } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

// Backend API URL - Für lokale Entwicklung
const API_URL = 'https://backend.app.mr-dk.de/api';
const FRONTEND_URL = 'https://backend.app.mr-dk.de';

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
    priority: 'medium',
    description: '',
    recurrence: { enabled: false, frequency: 'weekly', interval: 1 }
  });
  const [newCategory, setNewCategory] = useState({ name: '', color: '#3b82f6' });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    const saved = localStorage.getItem('collapsedCategories');
    return saved ? JSON.parse(saved) : {};
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // 'all', 'mine', 'unassigned', 'member:<userId>'
  const [completedByFilter, setCompletedByFilter] = useState('all'); // 'all' oder userId
  const [viewMode, setViewMode] = useState('tasks'); // 'tasks', 'archive', 'statistics'
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [statisticsTimeRange, setStatisticsTimeRange] = useState('all'); // 'all', '7days', '30days'
  const [notificationPreferences, setNotificationPreferences] = useState({
    dailyTaskReminder: true,
    reminderTime: '07:00',
    deadlineNotifications: true,
    taskAssignments: true
  });

  // Terminal Mode State
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [terminalToken, setTerminalToken] = useState(null);
  const [terminalHousehold, setTerminalHousehold] = useState(null);
  const [terminalMembers, setTerminalMembers] = useState([]);
  const [terminalTasks, setTerminalTasks] = useState([]);
  const [terminalCategories, setTerminalCategories] = useState([]);
  const [showWhoCompletedModal, setShowWhoCompletedModal] = useState(false);
  const [pendingCompleteTask, setPendingCompleteTask] = useState(null);
  const [terminalClock, setTerminalClock] = useState(new Date());
  const [showTerminalAddTask, setShowTerminalAddTask] = useState(false);
  const [showTerminalEditTask, setShowTerminalEditTask] = useState(false);
  const [editingTerminalTask, setEditingTerminalTask] = useState(null);
  const [terminalNewTask, setTerminalNewTask] = useState({ title: '', category: '', deadline: '', priority: 'medium', description: '' });
  const [terminalCollapsedCategories, setTerminalCollapsedCategories] = useState(() => {
    const saved = localStorage.getItem('terminalCollapsedCategories');
    return saved ? JSON.parse(saved) : {};
  });
  const [terminalPersonFilter, setTerminalPersonFilter] = useState('all');
  const [terminalTaskOverviewCollapsed, setTerminalTaskOverviewCollapsed] = useState(() => {
    return localStorage.getItem('terminalTaskOverviewCollapsed') === 'true';
  });

  // Terminal Mode: URL-Parameter oder localStorage Token erkennen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('terminal');
    const savedTerminalToken = localStorage.getItem('terminalToken');
    if (urlToken) {
      setIsTerminalMode(true);
      setTerminalToken(urlToken);
      localStorage.setItem('terminalToken', urlToken);
      initTerminalMode(urlToken);
    } else if (savedTerminalToken) {
      setIsTerminalMode(true);
      setTerminalToken(savedTerminalToken);
      initTerminalMode(savedTerminalToken);
    }
  }, []);

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
      loadNotificationPreferences(savedToken);
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

  // Persist collapsed categories
  useEffect(() => {
    localStorage.setItem('collapsedCategories', JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  // Persist terminal collapsed categories
  useEffect(() => {
    localStorage.setItem('terminalCollapsedCategories', JSON.stringify(terminalCollapsedCategories));
  }, [terminalCollapsedCategories]);

  useEffect(() => {
    localStorage.setItem('terminalTaskOverviewCollapsed', terminalTaskOverviewCollapsed);
  }, [terminalTaskOverviewCollapsed]);

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

  // Terminal Mode: Initialisierung
  const initTerminalMode = async (tToken) => {
    try {
      const authRes = await fetch(`${API_URL}/terminal/auth`, {
        headers: { Authorization: `Bearer ${tToken}` }
      });
      if (!authRes.ok) {
        alert('Ungültiger Terminal-Token');
        return;
      }
      const { household } = await authRes.json();
      setTerminalHousehold(household);
      setTerminalMembers(household.memberDetails);
      await refreshTerminalData(tToken, household._id);
    } catch (error) {
      console.error('Terminal Init Fehler:', error);
      alert('Fehler beim Laden des Terminals');
    }
  };

  // QR-Code scannen für Terminal-Modus
  const scanQRCode = async () => {
    try {
      // Prüfe ob Google Barcode Scanner Modul verfügbar ist
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        alert('Barcode-Scanner wird heruntergeladen. Bitte warte einen Moment und versuche es erneut.');
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return;
      }

      // Kamera-Berechtigung prüfen
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera === 'denied') {
        alert('Kamera-Berechtigung wird benötigt um QR-Codes zu scannen. Bitte in den App-Einstellungen aktivieren.');
        return;
      }
      if (camera !== 'granted') {
        const result = await BarcodeScanner.requestPermissions();
        if (result.camera !== 'granted') {
          alert('Kamera-Berechtigung wurde verweigert.');
          return;
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (barcodes.length > 0) {
        const rawValue = barcodes[0].rawValue;
        let extractedToken = rawValue;
        // Falls der QR-Code eine URL mit ?terminal=... enthält
        try {
          const url = new URL(rawValue);
          const urlToken = url.searchParams.get('terminal');
          if (urlToken) extractedToken = urlToken;
        } catch {
          // Kein URL-Format, nutze den Raw-Wert als Token
        }
        localStorage.setItem('terminalToken', extractedToken);
        setIsTerminalMode(true);
        setTerminalToken(extractedToken);
        initTerminalMode(extractedToken);
      }
    } catch (error) {
      console.error('QR-Code Scan Fehler:', error);
      alert('QR-Code Scan Fehler: ' + (error.message || error));
    }
  };

  // Terminal beenden
  const exitTerminalMode = () => {
    localStorage.removeItem('terminalToken');
    setIsTerminalMode(false);
    setTerminalToken(null);
    setTerminalHousehold(null);
    setTerminalMembers([]);
    setTerminalTasks([]);
    setTerminalCategories([]);
  };

  const refreshTerminalData = async (tToken, householdId) => {
    try {
      const [tasksRes, catRes] = await Promise.all([
        fetch(`${API_URL}/tasks?householdId=${householdId}`, { headers: { Authorization: `Bearer ${tToken}` } }),
        fetch(`${API_URL}/categories?householdId=${householdId}`, { headers: { Authorization: `Bearer ${tToken}` } })
      ]);
      setTerminalTasks(await tasksRes.json());
      setTerminalCategories(await catRes.json());
    } catch (error) {
      console.error('Terminal Refresh Fehler:', error);
    }
  };

  // Lade archivierte Aufgaben
  const loadArchivedTasks = async () => {
    if (!selectedHousehold) return;
    try {
      const response = await fetch(`${API_URL}/tasks/archived?householdId=${selectedHousehold._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setArchivedTasks(data);
    } catch (error) {
      console.error('Fehler beim Laden der archivierten Aufgaben:', error);
    }
  };

  // Lade Statistiken
  const loadStatistics = async (timeRange = statisticsTimeRange) => {
    if (!selectedHousehold) return;
    try {
      const response = await fetch(`${API_URL}/tasks/statistics?householdId=${selectedHousehold._id}&timeRange=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    }
  };

  // Lade Benachrichtigungseinstellungen
  const loadNotificationPreferences = async (authToken = token) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_URL}/user/notification-preferences`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setNotificationPreferences(data);
    } catch (error) {
      console.error('Fehler beim Laden der Benachrichtigungseinstellungen:', error);
    }
  };

  // Speichere Benachrichtigungseinstellungen
  const saveNotificationPreferences = async (preferences) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/user/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      });
      setNotificationPreferences(preferences);
      alert('Benachrichtigungseinstellungen gespeichert!');
    } catch (error) {
      console.error('Fehler beim Speichern der Benachrichtigungseinstellungen:', error);
      alert('Fehler beim Speichern der Einstellungen');
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

  // Terminal: Uhr aktualisieren
  useEffect(() => {
    if (!isTerminalMode) return;
    const clockInterval = setInterval(() => setTerminalClock(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [isTerminalMode]);

  // Terminal: Daten alle 30 Sekunden aktualisieren
  useEffect(() => {
    if (!isTerminalMode || !terminalToken || !terminalHousehold) return;
    const refreshInterval = setInterval(() => {
      refreshTerminalData(terminalToken, terminalHousehold._id);
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [isTerminalMode, terminalToken, terminalHousehold]);

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
      await loadNotificationPreferences(data.token);
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
      await loadNotificationPreferences(data.token);
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
        priority: 'medium',
        description: '',
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

  // Terminal Task-Operationen
  const terminalRequestCompleteTask = (task) => {
    setPendingCompleteTask(task);
    setShowWhoCompletedModal(true);
  };

  const terminalConfirmCompleteTask = async (memberId) => {
    if (!pendingCompleteTask) return;
    try {
      const res = await fetch(`${API_URL}/tasks/${pendingCompleteTask._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${terminalToken}` },
        body: JSON.stringify({ completed: true, completedBy: memberId })
      });
      if (res.ok) {
        const updated = await res.json();
        setTerminalTasks(prev => prev.map(t => t._id === updated._id ? updated : t));
      }
    } catch (error) {
      console.error('Fehler beim Erledigen:', error);
    } finally {
      setShowWhoCompletedModal(false);
      setPendingCompleteTask(null);
    }
  };

  const terminalDeleteTask = async (taskId) => {
    if (!confirm('Aufgabe wirklich löschen?')) return;
    try {
      await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${terminalToken}` }
      });
      setTerminalTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const terminalCreateTask = async (taskData) => {
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${terminalToken}` },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        const task = await res.json();
        setTerminalTasks(prev => [...prev, task]);
      }
    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
    }
  };

  const terminalUpdateTask = async (taskId, data) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${terminalToken}` },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updated = await res.json();
        setTerminalTasks(prev => prev.map(t => t._id === updated._id ? updated : t));
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    }
  };

  // Terminal Token verwalten
  const generateTerminalToken = async () => {
    try {
      const res = await fetch(`${API_URL}/households/${selectedHousehold._id}/terminal-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler');
      const updatedHouseholds = await fetch(`${API_URL}/households`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      setHouseholds(updatedHouseholds);
      const updatedH = updatedHouseholds.find(h => h._id === selectedHousehold._id);
      if (updatedH) setSelectedHousehold(updatedH);
    } catch (error) {
      alert('Fehler beim Erstellen des Terminal-Tokens');
    }
  };

  const revokeTerminalToken = async () => {
    if (!confirm('Terminal-Token wirklich widerrufen? Bestehende Terminal-URLs werden ungültig.')) return;
    try {
      await fetch(`${API_URL}/households/${selectedHousehold._id}/terminal-token`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedHouseholds = await fetch(`${API_URL}/households`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      setHouseholds(updatedHouseholds);
      const updatedH = updatedHouseholds.find(h => h._id === selectedHousehold._id);
      if (updatedH) setSelectedHousehold(updatedH);
    } catch (error) {
      alert('Fehler beim Widerrufen des Terminal-Tokens');
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

  // Toggle category collapse
  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Toggle terminal category collapse
  const toggleTerminalCategoryCollapse = (categoryId) => {
    setTerminalCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
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
    filteredTasks = filteredTasks.filter(task =>
      task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.includes(currentUser?.id)
    );
  } else if (assignmentFilter === 'unassigned') {
    filteredTasks = filteredTasks.filter(task =>
      !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0)
    );
  } else if (assignmentFilter.startsWith('member:')) {
    const memberId = assignmentFilter.split(':')[1];
    filteredTasks = filteredTasks.filter(task =>
      task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.includes(memberId)
    );
  }

  // Trenne aktive und erledigte Aufgaben
  const activeTasks = filteredTasks.filter(task => !task.completed);
  let completedTasks = filteredTasks.filter(task => task.completed);

  // Filter erledigte Aufgaben nach completedBy
  if (completedByFilter !== 'all') {
    completedTasks = completedTasks.filter(task => task.completedBy === completedByFilter);
  }

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

  // Anstehende Aufgaben-Übersicht (aus ungefiltertem tasks, nicht filteredTasks)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const allActiveTasks = tasks.filter(t => !t.completed);
  const overdueTasks = allActiveTasks
    .filter(t => t.deadline && new Date(t.deadline) < now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);
  const upcomingTasks = allActiveTasks
    .filter(t => t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= sevenDaysFromNow)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 8);

  // Terminal Mode: Ladescreen
  if (isTerminalMode && !terminalHousehold) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl font-light animate-pulse">Terminal wird geladen...</div>
      </div>
    );
  }

  // Terminal Mode: Haupt-Ansicht
  if (isTerminalMode && terminalHousehold) {
    const openTasks = terminalTasks.filter(t => !t.completed);
    const today = new Date();
    const todayCompleted = terminalTasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      return new Date(t.completedAt).toDateString() === today.toDateString();
    });

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex justify-between items-center border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">{terminalHousehold.name}</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-mono text-green-400">
                {terminalClock.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-sm text-gray-400 font-mono">
                {terminalClock.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            </div>
            <button
              onClick={exitTerminalMode}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex gap-4 overflow-x-auto">
          <div className="bg-gray-700 rounded-lg px-5 py-3 flex-shrink-0 text-center min-w-[80px]">
            <div className="text-3xl font-bold text-yellow-400">{openTasks.length}</div>
            <div className="text-xs text-gray-400 mt-1">Offen</div>
          </div>
          <div className="bg-gray-700 rounded-lg px-5 py-3 flex-shrink-0 text-center min-w-[80px]">
            <div className="text-3xl font-bold text-green-400">{todayCompleted.length}</div>
            <div className="text-xs text-gray-400 mt-1">Heute erledigt</div>
          </div>
          {terminalCategories.map(cat => (
            <div key={cat._id} className="rounded-lg px-5 py-3 flex-shrink-0 text-center bg-gray-700 min-w-[80px]" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <div className="text-3xl font-bold text-white">{openTasks.filter(t => t.category === cat._id).length}</div>
              <div className="text-xs text-gray-400 mt-1">{cat.name}</div>
            </div>
          ))}
        </div>

        {/* Person Filter Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setTerminalPersonFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              terminalPersonFilter === 'all'
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            Alle
          </button>
          {terminalMembers.map(member => {
            const memberOpenCount = openTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(member._id)).length;
            return (
              <button
                key={member._id}
                onClick={() => setTerminalPersonFilter(member._id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                  terminalPersonFilter === member._id
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" />
                {member.name}
                {memberOpenCount > 0 && (
                  <span className="ml-1 bg-gray-600 text-gray-200 rounded-full px-2 py-0.5 text-xs">{memberOpenCount}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setTerminalPersonFilter('unassigned')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              terminalPersonFilter === 'unassigned'
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Nicht zugewiesen
            {(() => { const c = openTasks.filter(t => !t.assignedTo || !Array.isArray(t.assignedTo) || t.assignedTo.length === 0).length; return c > 0 ? <span className="ml-1 bg-gray-600 text-gray-200 rounded-full px-2 py-0.5 text-xs">{c}</span> : null; })()}
          </button>
        </div>

        {/* Task Overview per Person */}
        <div className="mx-6 mt-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div
              className="px-4 py-3 flex items-center gap-3 border-b border-gray-700 cursor-pointer select-none hover:bg-gray-750"
              onClick={() => setTerminalTaskOverviewCollapsed(prev => !prev)}
            >
              <Users className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-bold text-white">Anstehende Aufgaben</h2>
              <span className="ml-auto text-sm text-gray-400">{openTasks.length} offen</span>
              {terminalTaskOverviewCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}
            </div>
            {!terminalTaskOverviewCollapsed && (
              <div className="p-4 grid grid-cols-2 gap-4">
                {terminalMembers.map(member => {
                  const memberTasks = openTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(member._id));
                  return (
                    <div key={member._id} className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-white">{member.name}</span>
                        <span className="ml-auto text-xs bg-gray-600 text-gray-200 rounded-full px-2 py-0.5">{memberTasks.length}</span>
                      </div>
                      {memberTasks.length === 0 ? (
                        <p className="text-gray-500 text-sm">Keine Aufgaben</p>
                      ) : (
                        <div className="space-y-1">
                          {memberTasks.map(task => (
                            <div key={task._id} className="flex items-center gap-2 text-sm">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                              <span className="text-gray-200 truncate">{task.title}</span>
                              {task.deadline && (
                                <span className={`ml-auto text-xs flex-shrink-0 ${getDeadlineStatus(task.deadline) === 'overdue' ? 'text-red-400' : 'text-gray-500'}`}>
                                  {formatDate(task.deadline)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Nicht zugewiesen */}
                {(() => {
                  const unassignedTasks = openTasks.filter(t => !t.assignedTo || !Array.isArray(t.assignedTo) || t.assignedTo.length === 0);
                  return (
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <span className="font-medium text-white">Nicht zugewiesen</span>
                        <span className="ml-auto text-xs bg-gray-600 text-gray-200 rounded-full px-2 py-0.5">{unassignedTasks.length}</span>
                      </div>
                      {unassignedTasks.length === 0 ? (
                        <p className="text-gray-500 text-sm">Keine Aufgaben</p>
                      ) : (
                        <div className="space-y-1">
                          {unassignedTasks.map(task => (
                            <div key={task._id} className="flex items-center gap-2 text-sm">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                              <span className="text-gray-200 truncate">{task.title}</span>
                              {task.deadline && (
                                <span className={`ml-auto text-xs flex-shrink-0 ${getDeadlineStatus(task.deadline) === 'overdue' ? 'text-red-400' : 'text-gray-500'}`}>
                                  {formatDate(task.deadline)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - 2-column grid with collapsible categories */}
        <div className="p-6 grid grid-cols-2 gap-6 pb-32">
          {terminalCategories.map(cat => {
            const allCatTasks = terminalTasks.filter(t => t.category === cat._id);
            const catTasks = terminalPersonFilter === 'all'
              ? allCatTasks
              : terminalPersonFilter === 'unassigned'
                ? allCatTasks.filter(t => !t.assignedTo || !Array.isArray(t.assignedTo) || t.assignedTo.length === 0)
                : allCatTasks.filter(t => Array.isArray(t.assignedTo) && t.assignedTo.includes(terminalPersonFilter));
            const isCollapsed = terminalCollapsedCategories[cat._id];
            const openCount = catTasks.filter(t => !t.completed).length;
            return (
              <div key={cat._id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center gap-3 border-b border-gray-700 cursor-pointer select-none hover:bg-gray-750"
                  onClick={() => toggleTerminalCategoryCollapse(cat._id)}
                >
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div>
                  <h2 className="text-lg font-bold text-white">{cat.name}</h2>
                  <span className="ml-auto text-sm text-gray-400">{openCount} offen</span>
                  {isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}
                </div>
                {!isCollapsed && (
                  <div className="p-3 space-y-2">
                    {catTasks.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-6">Keine Aufgaben</p>
                    ) : (
                      catTasks.map(task => (
                        <div key={task._id} className={`flex items-center gap-3 rounded-lg min-h-[80px] p-3 transition-colors ${
                          task.completed ? 'bg-gray-700/40 opacity-60' : 'bg-gray-700'
                        }`}>
                          <button
                            onClick={() => !task.completed && terminalRequestCompleteTask(task)}
                            disabled={task.completed}
                            className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                              task.completed ? 'bg-green-900/50 text-green-500 cursor-default' : 'bg-green-600 hover:bg-green-500 text-white active:scale-95'
                            }`}
                          >
                            <Check className="w-8 h-8" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-base font-medium leading-tight ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                              {task.title}
                            </p>
                            {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && (
                              <p className="text-xs text-blue-400 mt-0.5">
                                {task.assignedTo.map(id => terminalMembers.find(m => m._id === id)?.name).filter(Boolean).join(', ')}
                              </p>
                            )}
                            {task.deadline && (
                              <p className={`text-xs mt-1 ${getDeadlineStatus(task.deadline) === 'overdue' ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
                                {formatDate(task.deadline)}{getDeadlineStatus(task.deadline) === 'overdue' ? ' – ÜBERFÄLLIG' : ''}
                              </p>
                            )}
                            {task.completed && task.completedBy && (
                              <p className="text-xs text-green-400 mt-1">
                                ✓ {terminalMembers.find(m => m._id === task.completedBy)?.name || 'Unbekannt'}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => { setEditingTerminalTask({ ...task, deadline: utcToLocal(task.deadline) }); setShowTerminalEditTask(true); }}
                              className="w-12 h-12 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-gray-300 transition-colors"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => terminalDeleteTask(task._id)}
                              className="w-12 h-12 rounded-lg bg-red-900/40 hover:bg-red-900/70 flex items-center justify-center text-red-400 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FAB - Neue Aufgabe */}
        <button
          onClick={() => setShowTerminalAddTask(true)}
          className="fixed bottom-8 right-8 w-20 h-20 rounded-full bg-green-600 hover:bg-green-500 text-white shadow-2xl flex items-center justify-center transition-colors z-40 active:scale-95"
        >
          <Plus className="w-10 h-10" />
        </button>

        {/* WhoCompleted Modal */}
        {showWhoCompletedModal && pendingCompleteTask && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
            <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-lg border border-gray-700 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Wer hat erledigt?</h2>
              <p className="text-gray-400 text-center mb-8 text-lg">{pendingCompleteTask.title}</p>
              <div className="grid grid-cols-2 gap-4">
                {terminalMembers.map(member => (
                  <button
                    key={member._id}
                    onClick={() => terminalConfirmCompleteTask(member._id)}
                    className="min-h-[96px] bg-gray-700 hover:bg-green-700 rounded-xl text-xl font-bold text-white transition-colors active:scale-95"
                  >
                    {member.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowWhoCompletedModal(false); setPendingCompleteTask(null); }}
                className="mt-6 w-full py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-400 text-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showTerminalAddTask && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Neue Aufgabe</h2>
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={terminalNewTask.title}
                onChange={(e) => setTerminalNewTask({ ...terminalNewTask, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={terminalNewTask.category}
                onChange={(e) => setTerminalNewTask({ ...terminalNewTask, category: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Kategorie wählen</option>
                {terminalCategories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={terminalNewTask.deadline}
                onChange={(e) => setTerminalNewTask({ ...terminalNewTask, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={terminalNewTask.priority}
                onChange={(e) => setTerminalNewTask({ ...terminalNewTask, priority: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!terminalNewTask.title || !terminalNewTask.category) { alert('Bitte Titel und Kategorie angeben!'); return; }
                    await terminalCreateTask({ title: terminalNewTask.title, category: terminalNewTask.category, householdId: terminalHousehold._id, deadline: localToUTC(terminalNewTask.deadline), priority: terminalNewTask.priority, assignedTo: [] });
                    setTerminalNewTask({ title: '', category: '', deadline: '', priority: 'medium', description: '' });
                    setShowTerminalAddTask(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl text-lg font-medium transition-colors"
                >
                  Hinzufügen
                </button>
                <button
                  onClick={() => { setShowTerminalAddTask(false); setTerminalNewTask({ title: '', category: '', deadline: '', priority: 'medium', description: '' }); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-4 rounded-xl text-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {showTerminalEditTask && editingTerminalTask && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Aufgabe bearbeiten</h2>
              <input
                type="text"
                value={editingTerminalTask.title}
                onChange={(e) => setEditingTerminalTask({ ...editingTerminalTask, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={editingTerminalTask.category}
                onChange={(e) => setEditingTerminalTask({ ...editingTerminalTask, category: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {terminalCategories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={editingTerminalTask.deadline || ''}
                onChange={(e) => setEditingTerminalTask({ ...editingTerminalTask, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={editingTerminalTask.priority || 'medium'}
                onChange={(e) => setEditingTerminalTask({ ...editingTerminalTask, priority: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await terminalUpdateTask(editingTerminalTask._id, { title: editingTerminalTask.title, category: editingTerminalTask.category, deadline: localToUTC(editingTerminalTask.deadline), priority: editingTerminalTask.priority });
                    setShowTerminalEditTask(false);
                    setEditingTerminalTask(null);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl text-lg font-medium transition-colors"
                >
                  Speichern
                </button>
                <button
                  onClick={() => { setShowTerminalEditTask(false); setEditingTerminalTask(null); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-4 rounded-xl text-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-indigo-100 rounded-full mb-4">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Haushaltsplaner</h1>
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          {Capacitor.isNativePlatform() && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={scanQRCode}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <CheckSquare className="w-5 h-5" />
                QR-Code scannen (Terminal-Modus)
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
          <p className="text-gray-600 dark:text-gray-400">Lade Haushalt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{selectedHousehold.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hallo, {currentUser?.name}!</p>
              </div>
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className={`p-2 rounded-lg transition-all ${
                  isRefreshing
                    ? 'text-indigo-600 dark:text-indigo-400 animate-spin'
                    : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                }`}
                title="Aktualisieren (automatisch alle 10 Sek.)"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {pendingInvites.length > 0 && (
                <div className="relative">
                  <Mail className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
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
              {Capacitor.isNativePlatform() && (
                <button
                  onClick={scanQRCode}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="QR-Code scannen (Terminal-Modus)"
                >
                  <CheckSquare className="w-5 h-5" />
                  <span className="hidden sm:inline">Terminal</span>
                </button>
              )}
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
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
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
                <div key={invite.householdId} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-3 mb-2">
                  <span className="text-gray-800 dark:text-gray-100">{invite.householdName}</span>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Kategorien</h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
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
                    : 'text-gray-700 dark:text-gray-300 hover:opacity-80'
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
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Zuweisung</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAssignmentFilter('all')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  Alle
                </button>
                <button
                  onClick={() => setAssignmentFilter('mine')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'mine'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  Meine Aufgaben
                </button>
                {selectedHousehold.memberDetails?.filter(m => m._id !== currentUser?.id).map(member => (
                  <button
                    key={member._id}
                    onClick={() => setAssignmentFilter(`member:${member._id}`)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      assignmentFilter === `member:${member._id}`
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
                <button
                  onClick={() => setAssignmentFilter('unassigned')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    assignmentFilter === 'unassigned'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  Nicht zugewiesen
                </button>
              </div>
            </div>
          )}

          {viewMode === 'tasks' && (
            <button
              onClick={() => setShowAddTask(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Neue Aufgabe hinzufügen
            </button>
          )}
          <button
            onClick={() => setShowCalendar(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mt-3"
          >
            <Calendar className="w-5 h-5" />
            Kalenderansicht
          </button>

          {/* Ansicht-Umschalter */}
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Ansicht</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setViewMode('tasks')}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'tasks'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Aufgaben
              </button>
              <button
                onClick={() => {
                  setViewMode('archive');
                  loadArchivedTasks();
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'archive'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                }`}
              >
                <Archive className="w-4 h-4" />
                Archiv
              </button>
              <button
                onClick={() => {
                  setViewMode('statistics');
                  loadStatistics();
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'statistics'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                }`}
              >
                <BarChart className="w-4 h-4" />
                Statistiken
              </button>
            </div>
          </div>
        </div>

        {/* Einstellungen Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Einstellungen</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700"
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
                        <p className="font-medium text-gray-800 dark:text-gray-100">{member.name}</p>
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
                        <div key={idx} className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-50 p-2 rounded mb-1">
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
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Kategorien verwalten</h4>
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
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Keine Kategorien vorhanden</p>
                  ) : (
                    categories.map(cat => (
                      <div
                        key={cat._id}
                        className="flex flex-wrap items-center gap-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                          <div
                            className="w-6 h-6 rounded flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 dark:text-gray-100 break-words">{cat.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {tasks.filter(t => t.category === cat._id).length} Aufgaben
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setShowEditCategory(true);
                            }}
                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteCategory(cat._id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
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
                    <p className="font-medium text-gray-800 dark:text-gray-100">Dark Mode</p>
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

              <div className="border-t pt-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Benachrichtigungen
                </h4>
                <div className="space-y-4">
                  {/* Tägliche Aufgaben-Erinnerung */}
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">Tägliche Erinnerung</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Erhalte eine tägliche Übersicht deiner heutigen Aufgaben</p>
                      </div>
                      <button
                        onClick={() => {
                          const newPrefs = { ...notificationPreferences, dailyTaskReminder: !notificationPreferences.dailyTaskReminder };
                          saveNotificationPreferences(newPrefs);
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          notificationPreferences.dailyTaskReminder ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            notificationPreferences.dailyTaskReminder ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {notificationPreferences.dailyTaskReminder && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Uhrzeit
                        </label>
                        <input
                          type="time"
                          value={notificationPreferences.reminderTime}
                          onChange={(e) => {
                            const newPrefs = { ...notificationPreferences, reminderTime: e.target.value };
                            saveNotificationPreferences(newPrefs);
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Deadline-Benachrichtigungen */}
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">Deadline-Erinnerungen</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Benachrichtigungen für anstehende und überfällige Aufgaben</p>
                      </div>
                      <button
                        onClick={() => {
                          const newPrefs = { ...notificationPreferences, deadlineNotifications: !notificationPreferences.deadlineNotifications };
                          saveNotificationPreferences(newPrefs);
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          notificationPreferences.deadlineNotifications ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            notificationPreferences.deadlineNotifications ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Aufgaben-Zuweisungen */}
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-100">Aufgaben-Zuweisungen</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Benachrichtigungen wenn dir eine Aufgabe zugewiesen wird</p>
                      </div>
                      <button
                        onClick={() => {
                          const newPrefs = { ...notificationPreferences, taskAssignments: !notificationPreferences.taskAssignments };
                          saveNotificationPreferences(newPrefs);
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          notificationPreferences.taskAssignments ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            notificationPreferences.taskAssignments ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!selectedHousehold.isPrivate && (
                <div className="border-t pt-6 mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    Terminal-Modus
                  </h4>
                  {!selectedHousehold.terminalToken ? (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Erstelle einen Terminal-Token, um diesen Haushalt auf einem Tablet als dauerhaftes Dashboard zu verwenden. Kein Login erforderlich.
                      </p>
                      <button
                        onClick={generateTerminalToken}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Terminal-Token erstellen
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        QR-Code scannen oder Link kopieren, um das Terminal zu öffnen. Der Link funktioniert ohne Login.
                      </p>
                      <div className="flex flex-col items-center gap-4 mb-4">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${FRONTEND_URL}?terminal=${selectedHousehold.terminalToken}`)}`}
                          alt="Terminal QR-Code"
                          className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-600"
                        />
                        <div className="w-full flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${FRONTEND_URL}?terminal=${selectedHousehold.terminalToken}`);
                              alert('Link kopiert!');
                            }}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                          >
                            Link kopieren
                          </button>
                          <button
                            onClick={revokeTerminalToken}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Token widerrufen
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Konto</h4>
                <div className="space-y-2">
                  <p className="text-gray-600 dark:text-gray-400"><strong>Name:</strong> {currentUser?.name}</p>
                  <p className="text-gray-600 dark:text-gray-400"><strong>E-Mail:</strong> {currentUser?.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Einladungs-Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto pt-4 sm:pt-20">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Benutzer einladen</h3>
              <p className="text-gray-600 text-sm mb-4">
                Gib die E-Mail-Adresse des Benutzers ein, den du zu "{selectedHousehold.name}" einladen möchtest.
              </p>
              <input
                type="email"
                placeholder="E-Mail-Adresse"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
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
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Kategorie bearbeiten</h3>
              <input
                type="text"
                placeholder="Kategoriename"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Farbe</label>
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
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Neue Kategorie</h3>
              <input
                type="text"
                placeholder="Kategoriename"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Farbe</label>
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
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Neue Aufgabe</h3>
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />

              {/* Dringlichkeitsstufe */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dringlichkeit</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>

              {/* Beschreibung */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Beschreibung (optional)</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Weitere Details zur Aufgabe..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg resize-none"
                  rows="3"
                />
              </div>

              {selectedHousehold && !selectedHousehold.isPrivate && (
                <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Zugewiesen an:</p>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">Niemand zugewiesen</p>
                  )}
                </div>
              )}

              {/* Wiederkehrende Aufgabe */}
              <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Alle</span>
                      <input
                        type="number"
                        min="1"
                        value={newTask.recurrence.interval}
                        onChange={(e) => setNewTask({
                          ...newTask,
                          recurrence: { ...newTask.recurrence, interval: parseInt(e.target.value) || 1 }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
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
                      assignedTo: [],
                      priority: 'medium',
                      description: '',
                      recurrence: { enabled: false, frequency: 'weekly', interval: 1 }
                    });
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md my-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Aufgabe bearbeiten</h3>
              <input
                type="text"
                placeholder="Aufgabentitel"
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />
              <select
                value={editingTask.category}
                onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4"
              />

              {/* Dringlichkeitsstufe */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dringlichkeit</label>
                <select
                  value={editingTask.priority || 'medium'}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>

              {/* Beschreibung */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Beschreibung (optional)</label>
                <textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Weitere Details zur Aufgabe..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg resize-none"
                  rows="3"
                />
              </div>

              {selectedHousehold && !selectedHousehold.isPrivate && (
                <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Zugewiesen an:</p>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">Niemand zugewiesen</p>
                  )}
                </div>
              )}

              {/* Wiederkehrende Aufgabe */}
              <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="monthly">Monatlich</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Alle</span>
                      <input
                        type="number"
                        min="1"
                        value={editingTask.recurrence.interval}
                        onChange={(e) => setEditingTask({
                          ...editingTask,
                          recurrence: { ...editingTask.recurrence, interval: parseInt(e.target.value) || 1 }
                        })}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
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
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-4xl my-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kalenderansicht</h3>
                <button
                  onClick={() => setShowCalendar(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700"
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
                                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                  onClick={() => openEditTask(task)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                                    style={{ backgroundColor: category?.color || '#6B7280' }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="font-medium text-gray-800 dark:text-gray-100">{task.title}</div>
                                      {task.priority && (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          task.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' :
                                          task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100' :
                                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-100'
                                        }`}>
                                          {task.priority === 'low' ? 'Niedrig' : task.priority === 'high' ? 'Hoch' : 'Mittel'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {taskTime}
                                      {category && ` • ${category.name}`}
                                      {assignedNames && ` • ${assignedNames}`}
                                      {task.recurrence?.enabled && ' • 🔄'}
                                    </div>
                                    {task.description && (
                                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                                        {task.description}
                                      </div>
                                    )}
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
        {viewMode === 'tasks' && (
          <div className="space-y-6">
            {/* Anstehende Aufgaben-Übersicht */}
            {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-gray-800 dark:to-gray-800 rounded-xl shadow-md p-5 border border-orange-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Anstehende Aufgaben
                </h2>
                {overdueTasks.length > 0 && (
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Überfällig</h3>
                    <div className="space-y-2">
                      {overdueTasks.map(task => {
                        const cat = categories.find(c => c._id === task.category);
                        return (
                          <div key={task._id} className="flex items-center gap-3 bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2">
                            {cat && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                            <span className="font-medium text-red-800 dark:text-red-300 flex-1 text-sm">{task.title}</span>
                            <span className="text-xs text-red-600 dark:text-red-400">{formatDate(task.deadline)}</span>
                            {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                              <span className="text-xs text-red-500 dark:text-red-400">
                                {task.assignedTo.map(uid => selectedHousehold.memberDetails.find(m => m._id === uid)?.name || '?').join(', ')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {upcomingTasks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">In den nächsten 7 Tagen</h3>
                    <div className="space-y-2">
                      {upcomingTasks.map(task => {
                        const cat = categories.find(c => c._id === task.category);
                        return (
                          <div key={task._id} className="flex items-center gap-3 bg-white/60 dark:bg-gray-700/60 rounded-lg px-3 py-2">
                            {cat && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                            <span className="font-medium text-gray-800 dark:text-gray-200 flex-1 text-sm">{task.title}</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">{formatDate(task.deadline)}</span>
                            {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                              <span className="text-xs text-indigo-600 dark:text-indigo-400">
                                {task.assignedTo.map(uid => selectedHousehold.memberDetails.find(m => m._id === uid)?.name || '?').join(', ')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aktive Aufgaben - Gruppiert nach Kategorien */}
            <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Aktive Aufgaben ({activeTasks.length})
            </h2>
            {sortedActiveTasks.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg">Keine aktiven Aufgaben</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Gut gemacht! 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Group tasks by category
                  const grouped = {};
                  const uncategorized = [];
                  sortedActiveTasks.forEach(task => {
                    if (task.category) {
                      if (!grouped[task.category]) grouped[task.category] = [];
                      grouped[task.category].push(task);
                    } else {
                      uncategorized.push(task);
                    }
                  });

                  const categoryOrder = categories.filter(cat => grouped[cat._id]);

                  const renderTask = (task) => {
                    const category = categories.find(cat => cat._id === task.category);
                    const deadlineStatus = getDeadlineStatus(task.deadline);
                    const isOverdue = deadlineStatus === 'overdue';

                    return (
                      <div
                        key={task._id}
                        className={`p-4 transition-all ${
                          isOverdue ? 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20' : ''
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
                                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                            }`}
                          >
                            {task.completed && <Check className="w-4 h-4 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-medium ${isOverdue ? 'text-red-700 dark:text-red-400 font-bold' : 'text-gray-800 dark:text-gray-100'}`}>
                              {task.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {task.priority && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  task.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' :
                                  task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100' :
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-100'
                                }`}>
                                  {task.priority === 'low' ? 'Niedrig' : task.priority === 'high' ? 'Hoch' : 'Mittel'}
                                </span>
                              )}
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-xs">
                                  <Bell className={`w-3 h-3 ${
                                    deadlineStatus === 'overdue' ? 'text-red-500' :
                                    deadlineStatus === 'soon' ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'
                                  }`} />
                                  <span className={
                                    deadlineStatus === 'overdue' ? 'text-red-500 font-bold' :
                                    deadlineStatus === 'soon' ? 'text-orange-500 font-medium' : 'text-gray-600 dark:text-gray-400'
                                  }>
                                    {formatDate(task.deadline)}
                                    {isOverdue && ' - ÜBERFÄLLIG!'}
                                  </span>
                                </div>
                              )}
                              {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                                  <Users className="w-3 h-3" />
                                  <span>
                                    {task.assignedTo.map(userId =>
                                      selectedHousehold.memberDetails.find(m => m._id === userId)?.name || 'Unbekannt'
                                    ).join(', ')}
                                  </span>
                                </div>
                              )}
                              {task.recurrence?.enabled && (
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title="Wiederkehrende Aufgabe">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>
                                    {task.recurrence.frequency === 'daily' ? 'Täglich' :
                                     task.recurrence.frequency === 'weekly' ? 'Wöchentlich' : 'Monatlich'}
                                  </span>
                                </div>
                              )}
                            </div>
                            {task.description && (
                              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2">
                                {task.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditTask(task)}
                              className="flex-shrink-0 p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deleteTask(task._id)}
                              className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {categoryOrder.map(cat => {
                        const catTasks = grouped[cat._id];
                        const isCollapsed = collapsedCategories[cat._id];
                        return (
                          <div key={cat._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <button
                              onClick={() => toggleCategoryCollapse(cat._id)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex-1 text-left">{cat.name}</h3>
                              <span className="text-sm text-gray-500 dark:text-gray-400">{catTasks.length} Aufgaben</span>
                              {isCollapsed ? (
                                <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                              ) : (
                                <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                              )}
                            </button>
                            {!isCollapsed && (
                              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {catTasks.map(renderTask)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {uncategorized.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                          <button
                            onClick={() => toggleCategoryCollapse('uncategorized')}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-400" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex-1 text-left">Ohne Kategorie</h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{uncategorized.length} Aufgaben</span>
                            {collapsedCategories['uncategorized'] ? (
                              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            ) : (
                              <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            )}
                          </button>
                          {!collapsedCategories['uncategorized'] && (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {uncategorized.map(renderTask)}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Erledigte Aufgaben */}
          {completedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center justify-between w-full text-left mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Erledigte Aufgaben ({completedTasks.length})
                </h2>
                {showCompleted ? (
                  <ChevronUp className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {showCompleted && (
                <>
                  {/* Filter nach "Erledigt von" */}
                  {selectedHousehold && selectedHousehold.memberDetails && selectedHousehold.memberDetails.length > 1 && (
                    <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Filter: Erledigt von
                      </label>
                      <select
                        value={completedByFilter}
                        onChange={(e) => setCompletedByFilter(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                      >
                        <option value="all">Alle anzeigen</option>
                        {selectedHousehold.memberDetails.map(member => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                <div className="space-y-3">
                  {completedTasks.map(task => {
                    const category = categories.find(cat => cat._id === task.category);
                    
                    return (
                      <div
                        key={task._id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleTask(task)}
                            className="mt-1 flex-shrink-0 w-6 h-6 rounded-md border-2 bg-green-500 border-green-500 flex items-center justify-center transition-colors"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-800 dark:text-gray-100 line-through">
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
                              {task.priority && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  task.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' :
                                  task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100' :
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-100'
                                }`}>
                                  {task.priority === 'low' ? 'Niedrig' : task.priority === 'high' ? 'Hoch' : 'Mittel'}
                                </span>
                              )}
                              {task.completedAt && (
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                  <Check className="w-3 h-3" />
                                  <span>
                                    Erledigt am {formatDate(task.completedAt)}
                                  </span>
                                </div>
                              )}
                              {task.completedBy && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                                  <User className="w-3 h-3" />
                                  <span>
                                    Erledigt von {getCompletedByName(task.completedBy)}
                                  </span>
                                </div>
                              )}
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                  <Bell className="w-3 h-3" />
                                  <span>
                                    Frist: {formatDate(task.deadline)}
                                  </span>
                                </div>
                              )}
                              {task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && selectedHousehold?.memberDetails && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                                  <Users className="w-3 h-3" />
                                  <span>
                                    {task.assignedTo.map(userId =>
                                      selectedHousehold.memberDetails.find(m => m._id === userId)?.name || 'Unbekannt'
                                    ).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            {task.description && (
                              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2 line-through">
                                {task.description}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditTask(task)}
                              className="flex-shrink-0 p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deleteTask(task._id)}
                              className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}
          </div>
        )}

        {/* Archiv-Ansicht */}
        {viewMode === 'archive' && (() => {
          // Filter archivierte Aufgaben nach completedBy
          const filteredArchivedTasks = completedByFilter !== 'all'
            ? archivedTasks.filter(task => task.completedBy === completedByFilter)
            : archivedTasks;

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Archiv ({filteredArchivedTasks.length})
                </h2>
              </div>

              {/* Filter nach "Erledigt von" */}
              {selectedHousehold && selectedHousehold.memberDetails && selectedHousehold.memberDetails.length > 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter: Erledigt von
                  </label>
                  <select
                    value={completedByFilter}
                    onChange={(e) => setCompletedByFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                  >
                    <option value="all">Alle anzeigen</option>
                    {selectedHousehold.memberDetails.map(member => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filteredArchivedTasks.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
                  <Archive className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    {completedByFilter !== 'all' ? 'Keine archivierten Aufgaben für diesen Filter' : 'Keine archivierten Aufgaben'}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Erledigte Aufgaben werden nach 14 Tagen automatisch archiviert</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArchivedTasks.map(task => {
                  const category = categories.find(cat => cat._id === task.category);

                  return (
                    <div
                      key={task._id}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 dark:text-gray-100 line-through">
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
                            {task.priority && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                task.priority === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' :
                                task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100' :
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-600 dark:text-yellow-100'
                              }`}>
                                {task.priority === 'low' ? 'Niedrig' : task.priority === 'high' ? 'Hoch' : 'Mittel'}
                              </span>
                            )}
                            {task.completedAt && (
                              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                <Check className="w-3 h-3" />
                                <span>
                                  Erledigt am {formatDate(task.completedAt)}
                                </span>
                              </div>
                            )}
                            {task.completedBy && (
                              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                <User className="w-3 h-3" />
                                <span>
                                  von {getCompletedByName(task.completedBy)}
                                </span>
                              </div>
                            )}
                          </div>
                          {task.description && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2 line-through">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        })()}

        {/* Statistik-Ansicht */}
        {viewMode === 'statistics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                Statistiken
              </h2>
            </div>

            {/* Zeitraum-Auswahl */}
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Zeitraum
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStatisticsTimeRange('all');
                    loadStatistics('all');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    statisticsTimeRange === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  Gesamt
                </button>
                <button
                  onClick={() => {
                    setStatisticsTimeRange('30days');
                    loadStatistics('30days');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    statisticsTimeRange === '30days'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  30 Tage
                </button>
                <button
                  onClick={() => {
                    setStatisticsTimeRange('7days');
                    loadStatistics('7days');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    statisticsTimeRange === '7days'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  7 Tage
                </button>
              </div>
            </div>

            {statistics.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
                <BarChart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg">Keine Statistiken verfügbar</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Erledigt Aufgaben, um Statistiken zu sehen</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Erledigte Aufgaben pro Person
                  {statisticsTimeRange === '7days' && ' (Letzte 7 Tage)'}
                  {statisticsTimeRange === '30days' && ' (Letzte 30 Tage)'}
                  {statisticsTimeRange === 'all' && ' (Gesamt)'}
                </h3>
                <div className="space-y-4">
                  {statistics.map((stat, index) => {
                    const maxCount = Math.max(...statistics.map(s => s.completedCount));
                    const percentage = (stat.completedCount / maxCount) * 100;

                    return (
                      <div key={stat.userId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                              index === 0 ? 'bg-yellow-500' :
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-orange-600' : 'bg-indigo-500'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-gray-100">{stat.userName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.userEmail}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stat.completedCount}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Aufgaben</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}