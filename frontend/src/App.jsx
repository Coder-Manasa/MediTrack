
import { useEffect, useMemo, useState } from "react";
import {
  Activity, LayoutDashboard, Users, BedDouble, Bell, Settings,
  CircleHelp, Search, Plus, Download, Menu, X, UserRound,
  LogOut, ChevronDown, Check, Trash2, Pencil, UserCheck,
  TrendingUp, CalendarDays, Stethoscope, AlertCircle, CheckCircle,
  Mail, Phone, Moon, Sun, RefreshCw, Filter, Building2,
  Clock, ShieldCheck, ArrowUpRight, FileText
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const OPTIONS = {
  genders: ["Female", "Male", "Other"],
  wards: ["General Ward", "ICU", "Emergency", "Maternity", "Pediatrics", "Private Ward"],
  departments: ["Cardiology", "Neurology", "Orthopedics", "General Medicine", "Pediatrics", "Oncology", "Gynecology"],
  doctors: ["Dr. Ananya Rao", "Dr. Rahul Sharma", "Dr. Meera Nair", "Dr. Arjun Kumar", "Dr. Priya Menon"]
};

const EMPTY_PATIENT = {
  name: "", age: "", gender: "", ward: "", department: "",
  doctor: "", admission_date: new Date().toISOString().slice(0, 10)
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Something went wrong. Please try again.");
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function initials(name = "Hospital Admin") {
  return name.split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
}

function App() {
  const [page, setPage] = useState("Overview");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [patients, setPatients] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [profile, setProfile] = useState({
    name: "Hospital Admin",
    email: "admin@meditrack.com",
    role: "Administrator"
  });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    ward: "", department: "", doctor: "", status: ""
  });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PATIENT);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem("meditrack-theme") === "dark");
  const [compact, setCompact] = useState(localStorage.getItem("meditrack-compact") === "true");
  const [saving, setSaving] = useState(false);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  async function loadPatients() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const data = await request(`/api/patients?${params.toString()}`);
    setPatients(data);
  }

  async function loadNotifications() {
    const data = await request("/api/notifications");
    setNotifications(data.notifications || []);
    setUnread(data.unread_count || 0);
  }

  async function loadProfile() {
    const data = await request("/api/profile");
    setProfile(data);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadPatients(), loadNotifications(), loadProfile()]);
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPatients().catch(error => notify(error.message));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, filters]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("meditrack-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("meditrack-compact", String(compact));
  }, [compact]);

  const admitted = patients.filter(p => p.status !== "Discharged");
  const discharged = patients.filter(p => p.status === "Discharged");
  const today = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, "0")}-${String(currentTime.getDate()).padStart(2, "0")}`;
  const admittedToday = patients.filter(p => p.admission_date === today).length;

  const wardStats = useMemo(() => OPTIONS.wards.map(ward => ({
    name: ward,
    count: admitted.filter(p => p.ward === ward).length
  })), [patients]);

  const departmentStats = useMemo(() => OPTIONS.departments.map(department => ({
    name: department,
    count: admitted.filter(p => p.department === department).length
  })).sort((a, b) => b.count - a.count), [patients]);

  const maxWard = Math.max(1, ...wardStats.map(x => x.count));
  const maxDepartment = Math.max(1, ...departmentStats.map(x => x.count));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PATIENT);
    setModal(true);
  }

  function openEdit(patient) {
    setEditing(patient);
    setForm({
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      ward: patient.ward,
      department: patient.department,
      doctor: patient.doctor,
      admission_date: patient.admission_date
    });
    setModal(true);
  }

  async function savePatient(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, age: Number(form.age) };
      await request(
        editing ? `/api/patients/${editing.id}` : "/api/patients",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );
      setModal(false);
      await Promise.all([loadPatients(), loadNotifications()]);
      notify(editing ? "Patient details updated" : "New patient admitted successfully");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function dischargePatient(patient) {
    if (!window.confirm(`Discharge ${patient.name}?`)) return;
    try {
      await request(`/api/patients/${patient.id}/discharge`, { method: "PATCH" });
      await Promise.all([loadPatients(), loadNotifications()]);
      notify("Patient discharged successfully");
    } catch (error) {
      notify(error.message);
    }
  }

  async function deletePatient(patient) {
    if (!window.confirm(`Permanently delete ${patient.name}'s record?`)) return;
    try {
      await request(`/api/patients/${patient.id}`, { method: "DELETE" });
      await Promise.all([loadPatients(), loadNotifications()]);
      notify("Patient record deleted");
    } catch (error) {
      notify(error.message);
    }
  }

  async function markRead(item) {
    try {
      await request(`/api/notifications/${item.id}/read`, { method: "PATCH" });
      await loadNotifications();
    } catch (error) {
      notify(error.message);
    }
  }

  async function markAllRead() {
    try {
      await request("/api/notifications/read-all", { method: "POST" });
      await loadNotifications();
      notify("All notifications marked as read");
    } catch (error) {
      notify(error.message);
    }
  }

  async function removeNotification(item) {
    try {
      await request(`/api/notifications/${item.id}`, { method: "DELETE" });
      await loadNotifications();
      notify("Notification deleted");
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await request("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name: profile.name, email: profile.email })
      });
      setProfile(data);
      await loadNotifications();
      notify("Profile saved successfully");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const columns = ["name", "age", "gender", "ward", "department", "doctor", "admission_date", "status"];
    const rows = [
      columns.join(","),
      ...patients.map(patient =>
        columns.map(key => `"${String(patient[key] ?? "").replaceAll('"', '""')}"`).join(",")
      )
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meditrack-patients.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Patient report exported");
  }

  const navigation = [
    { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
    { label: "Patients", icon: Users },
    { label: "Ward overview", icon: BedDouble },
    { label: "Notifications", icon: Bell, count: unread },
    { label: "Settings", icon: Settings, group: "PREFERENCES" },
    { label: "Help & Support", icon: CircleHelp }
  ];

  function navigate(label) {
    setPage(label);
    setMobileMenu(false);
  }

  function renderPatientTable(rows) {
    return (
      <div className="table-wrap">
        <table className={compact ? "patient-table compact" : "patient-table"}>
          <thead>
            <tr>
              <th>Patient</th><th>Ward</th><th>Department</th>
              <th>Doctor</th><th>Admission</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(patient => (
              <tr key={patient.id}>
                <td>
                  <div className="patient-cell">
                    <div className="patient-avatar">{initials(patient.name)}</div>
                    <div><strong>{patient.name}</strong><small>{patient.age} years · {patient.gender}</small></div>
                  </div>
                </td>
                <td>{patient.ward}</td>
                <td>{patient.department}</td>
                <td>{patient.doctor}</td>
                <td>{formatDate(patient.admission_date)}</td>
                <td><span className={`status ${patient.status === "Discharged" ? "discharged" : "admitted"}`}>{patient.status}</span></td>
                <td>
                  <div className="action-buttons">
                    <button className="icon-button" title="Edit patient" onClick={() => openEdit(patient)}><Pencil size={16}/></button>
                    {patient.status !== "Discharged" && <button className="icon-button" title="Discharge patient" onClick={() => dischargePatient(patient)}><UserCheck size={16}/></button>}
                    <button className="icon-button danger" title="Delete patient" onClick={() => deletePatient(patient)}><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="empty-state">No patients found. Add a patient or change your filters.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  function dashboardPage() {
    return (
      <>
        <div className="welcome-row">
          <div>
            <div className="eyebrow">
              {currentTime.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
              }).toUpperCase()}
            </div>

            <h1>
              {currentTime.getHours() >= 5 && currentTime.getHours() < 12
                ? "Good morning"
                : currentTime.getHours() >= 12 && currentTime.getHours() < 17
                ? "Good afternoon"
                : currentTime.getHours() >= 17 && currentTime.getHours() < 21
                ? "Good evening"
                : "Good night"},
              {" "}{profile.name.split(" ")[0]} <span>👋</span>
            </h1>

            <p>Here’s what’s happening across your hospital today.</p>
        </div>
          <button className="primary-button" onClick={openCreate}><Plus size={18}/> Add patient</button>
        </div>

        <div className="stats-grid">
          <StatCard icon={Users} label="Total patients" value={patients.length} note="All patient records" tone="blue"/>
          <StatCard icon={Activity} label="Currently admitted" value={admitted.length} note="Active admissions" tone="green"/>
          <StatCard icon={UserCheck} label="Discharged patients" value={discharged.length} note="Completed admissions" tone="purple"/>
          <StatCard icon={CalendarDays} label="Admissions today" value={admittedToday} note="Based on admission date" tone="orange"/>
        </div>

        <div className="analytics-grid">
          <section className="panel">
            <div className="panel-heading"><div><h3>Ward occupancy</h3><p>Current admitted patients by ward</p></div><BedDouble size={20}/></div>
            <div className="bar-list">
              {wardStats.map(item => <div className="bar-item" key={item.name}><div className="bar-label"><span>{item.name}</span><strong>{item.count}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${item.count / maxWard * 100}%` }}/></div></div>)}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><h3>Department distribution</h3><p>Admissions across departments</p></div><Building2 size={20}/></div>
            <div className="bar-list">
              {departmentStats.map(item => <div className="bar-item" key={item.name}><div className="bar-label"><span>{item.name}</span><strong>{item.count}</strong></div><div className="bar-track"><div className="bar-fill department-fill" style={{ width: `${item.count / maxDepartment * 100}%` }}/></div></div>)}
            </div>
          </section>
        </div>

        <section className="panel table-panel">
          <div className="panel-heading"><div><h3>Recent patient records</h3><p>Latest patient activity</p></div><button className="text-button" onClick={() => navigate("Patients")}>View all <ArrowUpRight size={15}/></button></div>
          {renderPatientTable([...patients].slice(0, 5))}
        </section>
      </>
    );
  }

  function patientsPage() {
    return (
      <>
        <PageHeading title="Patient management" subtitle="Manage admissions, patient records and discharge information." action={<button className="primary-button" onClick={openCreate}><Plus size={18}/> Add patient</button>}/>
        <section className="panel">
          <div className="filter-row">
            <div className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient by name..."/></div>
            <select value={filters.ward} onChange={e => setFilters({ ...filters, ward: e.target.value })}><option value="">All wards</option>{OPTIONS.wards.map(x => <option key={x}>{x}</option>)}</select>
            <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}><option value="">All departments</option>{OPTIONS.departments.map(x => <option key={x}>{x}</option>)}</select>
            <select value={filters.doctor} onChange={e => setFilters({ ...filters, doctor: e.target.value })}><option value="">All doctors</option>{OPTIONS.doctors.map(x => <option key={x}>{x}</option>)}</select>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Admitted</option><option>Discharged</option></select>
            <button className="secondary-button" onClick={exportCSV}><Download size={16}/> Export</button>
          </div>
          <div className="result-count">{patients.length} patient record{patients.length === 1 ? "" : "s"} found</div>
          {renderPatientTable(patients)}
        </section>
      </>
    );
  }

  function wardsPage() {
    return (
      <>
        <PageHeading title="Ward overview" subtitle="Monitor patient distribution across hospital wards."/>
        <div className="ward-grid">
          {wardStats.map((ward, index) => (
            <div className="panel ward-card" key={ward.name}>
              <div className="ward-icon"><BedDouble size={22}/></div>
              <span className="muted">WARD {String(index + 1).padStart(2, "0")}</span>
              <h3>{ward.name}</h3>
              <div className="ward-number">{ward.count}<small> patients admitted</small></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${ward.count / maxWard * 100}%` }}/></div>
            </div>
          ))}
        </div>
        <section className="panel table-panel"><div className="panel-heading"><div><h3>Department insights</h3><p>Active admissions by department</p></div></div>{departmentStats.map(d => <div className="insight-row" key={d.name}><span>{d.name}</span><strong>{d.count}</strong></div>)}</section>
      </>
    );
  }

  function notificationsPage() {
    return (
      <>
        <PageHeading title="Notifications" subtitle="Stay updated on patient admissions and hospital activity." action={unread > 0 ? <button className="secondary-button" onClick={markAllRead}><Check size={16}/> Mark all as read</button> : null}/>
        <section className="panel notification-list">
          {notifications.length === 0 && <div className="empty-large"><Bell size={32}/><h3>You're all caught up</h3><p>New patient activity will appear here.</p></div>}
          {notifications.map(item => (
            <div className={`notification-item ${item.is_read ? "" : "unread"}`} key={item.id}>
              <div className={`notification-icon ${item.type || "info"}`}>{item.type === "success" ? <CheckCircle/> : item.type === "warning" ? <AlertCircle/> : <Bell/>}</div>
              <div className="notification-content"><strong>{item.title}</strong><p>{item.message}</p><small><Clock size={13}/> {new Date(item.created_at + "Z").toLocaleString("en-IN")}</small></div>
              <div className="notification-actions">{!item.is_read && <button className="text-button" onClick={() => markRead(item)}>Mark read</button>}<button className="icon-button danger" title="Delete notification" onClick={() => removeNotification(item)}><Trash2 size={16}/></button></div>
            </div>
          ))}
        </section>
      </>
    );
  }

  function profilePage() {
    return (
      <>
        <PageHeading title="Administrator profile" subtitle="Manage your account information."/>
        <section className="panel profile-panel">
          <div className="profile-banner"><div className="large-avatar">{initials(profile.name)}</div><div><h3>{profile.name}</h3><p>{profile.role || "Administrator"}</p></div><span className="verified"><ShieldCheck size={15}/> Admin account</span></div>
          <form className="profile-form" onSubmit={saveProfile}>
            <label>Full name<input required minLength="2" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label>
            <label>Email address<input required type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label>
            <label>Role<input value={profile.role || "Administrator"} disabled/></label>
            <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save profile changes"}</button>
          </form>
        </section>
      </>
    );
  }

  function settingsPage() {
    return (
      <>
        <PageHeading title="Settings & preferences" subtitle="Personalize your MediTrack workspace."/>
        <section className="panel settings-panel">
          <div className="settings-row"><div className="settings-icon">{dark ? <Moon/> : <Sun/>}</div><div className="settings-description"><strong>Appearance</strong><p>Choose the visual theme for your workspace.</p></div><button className={`toggle ${dark ? "on" : ""}`} onClick={() => setDark(!dark)} aria-label="Toggle dark theme"><span/></button><span className="setting-value">{dark ? "Dark" : "Light"}</span></div>
          <div className="settings-row"><div className="settings-icon"><FileText/></div><div className="settings-description"><strong>Compact patient tables</strong><p>Show more patient records in less space.</p></div><button className={`toggle ${compact ? "on" : ""}`} onClick={() => setCompact(!compact)} aria-label="Toggle compact tables"><span/></button><span className="setting-value">{compact ? "On" : "Off"}</span></div>
          <div className="settings-row"><div className="settings-icon"><RefreshCw/></div><div className="settings-description"><strong>Refresh dashboard data</strong><p>Reload patients, profile and notifications.</p></div><button className="secondary-button" onClick={refreshAll}><RefreshCw size={16}/> Refresh now</button></div>
          <div className="settings-row"><div className="settings-icon"><Download/></div><div className="settings-description"><strong>Export patient records</strong><p>Download the currently loaded patient records as CSV.</p></div><button className="secondary-button" onClick={exportCSV}><Download size={16}/> Export CSV</button></div>
        </section>
      </>
    );
  }

  function helpPage() {
    const faqs = [
      ["How do I add a patient?", "Open Patient management and select Add patient. Complete all required fields and save."],
      ["How do I discharge a patient?", "Find the patient in the patient table and select the discharge icon. Confirm the action."],
      ["Can I export patient records?", "Yes. Use the Export button in Patient management to download a CSV file."],
      ["Where can I see patient activity?", "Open Notifications to view admission, update, discharge and deletion activity."],
      ["How do I change my profile?", "Open Administrator profile, update your name or email, and save your changes."]
    ];
    return (
      <>
        <PageHeading title="Help & support" subtitle="Find answers and get assistance with MediTrack."/>
        <div className="help-grid">
          <div className="panel help-contact"><div className="help-icon"><CircleHelp size={26}/></div><h3>How can we help?</h3><p>Explore the common questions or contact the support team for assistance.</p><a href="mailto:support@meditrack.com"><Mail size={16}/> Email support</a><a href="tel:+910000000000"><Phone size={16}/> Contact support</a></div>
          <div className="panel faq-panel"><h3>Frequently asked questions</h3>{faqs.map(([q, a]) => <details key={q}><summary>{q}<ChevronDown size={17}/></summary><p>{a}</p></details>)}</div>
        </div>
      </>
    );
  }

  let content;
  switch (page) {
    case "Patients": content = patientsPage(); break;
    case "Ward overview": content = wardsPage(); break;
    case "Notifications": content = notificationsPage(); break;
    case "Settings": content = settingsPage(); break;
    case "Help & Support": content = helpPage(); break;
    case "Profile": content = profilePage(); break;
    default: content = dashboardPage();
  }

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu"/>}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Activity size={23}/></div><div><strong>MediTrack</strong><small>HOSPITAL MANAGEMENT</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><X/></button></div>
        <div className="nav-caption">MAIN MENU</div>
        <nav>{navigation.map((item, index) => <div key={item.label}>{item.group && index > 0 && <div className="nav-caption nav-spaced">{item.group}</div>}<button className={`nav-item ${page === item.label ? "active" : ""}`} onClick={() => navigate(item.label)}><item.icon size={19}/><span>{item.label}</span>{item.count > 0 && <b className="nav-count">{item.count}</b>}</button></div>)}</nav>
        <div className="sidebar-bottom"><div className="support-mini"><div className="support-mini-icon"><ShieldCheck size={18}/></div><strong>Your data, protected</strong><p>Patient records are managed securely in your MediTrack workspace.</p></div><button className="sidebar-profile" onClick={() => navigate("Profile")}><div className="avatar">{initials(profile.name)}</div><div><strong>{profile.name}</strong><small>{profile.role || "Administrator"}</small></div><ChevronDown size={16}/></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div></div><div className="topbar-actions"><span className="system-status"><i/> System operational</span><button className="top-icon" title="Refresh data" onClick={refreshAll}><RefreshCw size={18}/></button><button className="top-icon notification-trigger" title="Notifications" onClick={() => navigate("Notifications")}><Bell size={19}/>{unread > 0 && <i/>}</button><button className="top-profile" onClick={() => navigate("Profile")}><div className="avatar">{initials(profile.name)}</div><span>{profile.name.split(" ")[0]}</span><ChevronDown size={15}/></button></div></header>
        <div className="page-content">
          {loading ? <div className="loading-state"><div className="spinner"/><p>Loading MediTrack workspace...</p></div> : content}
        </div>
        <footer className="footer"><span>© {new Date().getFullYear()} MediTrack · Hospital Management System</span><span>Designed for better patient care</span></footer>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}><form className="patient-modal" onSubmit={savePatient}>
        <div className="modal-heading"><div><span className="eyebrow">PATIENT RECORD</span><h2>{editing ? "Edit patient" : "Add new patient"}</h2><p>Enter the patient information below.</p></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X/></button></div>
        <div className="form-grid">
          <label className="full-field">Patient full name<input required pattern="[A-Za-z ]+" maxLength="80" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name"/></label>
          <label>Age<input required type="number" min="0" max="120" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="Age"/></label>
          <label>Gender<select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Select gender</option>{OPTIONS.genders.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Ward<select required value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })}><option value="">Select ward</option>{OPTIONS.wards.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Department<select required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}><option value="">Select department</option>{OPTIONS.departments.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="full-field">Doctor<select required value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })}><option value="">Select doctor</option>{OPTIONS.doctors.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="full-field">Admission date<input required type="date" max={today} value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })}/></label>
        </div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add patient"}</button></div>
      </form></div>}
      {toast && <div className="toast"><CheckCircle size={18}/>{toast}</div>}
    </div>
  );
  useEffect(() => {
  const timer = window.setInterval(() => {
    setCurrentTime(new Date());
  }, 60000);

  return () => window.clearInterval(timer);
  }, []);
}

function StatCard({ icon: Icon, label, value, note, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={21}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}

function PageHeading({ title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">MEDTRACK WORKSPACE</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

export default App;