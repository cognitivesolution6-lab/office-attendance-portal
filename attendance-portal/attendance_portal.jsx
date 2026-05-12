import { useState, useEffect } from "react";

const EMPLOYEES = [
  { id: 1, name: "Ahmed Ali", designation: "Software Engineer", dept: "IT" },
  { id: 2, name: "Sara Khan", designation: "HR Manager", dept: "HR" },
  { id: 3, name: "Usman Raza", designation: "Accountant", dept: "Finance" },
];

const OFFICE_START = "09:00";
const LATE_THRESHOLD = "09:15";
const DAILY_DEDUCTION = 200; // PKR per late day

const STATUS_COLORS = {
  present: "#10b981",
  absent: "#ef4444",
  late: "#f59e0b",
  leave: "#6366f1",
  holiday: "#8b5cf6",
  half: "#06b6d4",
};

const getToday = () => new Date().toISOString().split("T")[0];
const getTime = () => new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });

function getMonthDays(year, month) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function AttendancePortal() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [attendance, setAttendance] = useState({});
  const [activities, setActivities] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState(null);
  const [activityInput, setActivityInput] = useState("");
  const [leaveForm, setLeaveForm] = useState({ from: "", to: "", type: "annual", reason: "" });
  const [notification, setNotification] = useState(null);
  const [viewMonth, setViewMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getAttKey = (userId, date) => `${userId}_${date}`;

  const todayKey = currentUser ? getAttKey(currentUser.id, getToday()) : null;
  const todayAtt = todayKey ? attendance[todayKey] : null;

  const markAttendance = (type) => {
    if (!currentUser) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false });
    const displayTime = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) };
        setAttendance((prev) => {
          const existing = prev[todayKey] || {};
          if (type === "in" && existing.checkIn) { showNotif("Aap pehle se check-in kar chuke hain!", "error"); return prev; }
          if (type === "out" && !existing.checkIn) { showNotif("Pehle Check-In karein!", "error"); return prev; }

          const isLate = type === "in" && timeStr > "09:15";
          return {
            ...prev,
            [todayKey]: {
              ...existing,
              date: getToday(),
              userId: currentUser.id,
              ...(type === "in" ? { checkIn: displayTime, checkInRaw: timeStr, checkInLoc: loc, isLate } : { checkOut: displayTime, checkOutLoc: loc }),
              status: existing.status || (isLate ? "late" : "present"),
            },
          };
        });
        setLocationStatus({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) });
        showNotif(`✅ ${type === "in" ? "Check-In" : "Check-Out"} ho gaye! ${displayTime} — Location capture ho gayi`);
      },
      () => {
        showNotif("Location access denied. Phir bhi attendance mark ho rahi hai.", "warning");
        setAttendance((prev) => {
          const existing = prev[todayKey] || {};
          const isLate = type === "in" && new Date().getHours() * 60 + new Date().getMinutes() > 9 * 60 + 15;
          return {
            ...prev,
            [todayKey]: {
              ...existing,
              date: getToday(),
              userId: currentUser.id,
              ...(type === "in" ? { checkIn: displayTime, checkInRaw: timeStr, isLate, checkInLoc: null } : { checkOut: displayTime, checkOutLoc: null }),
              status: existing.status || (isLate ? "late" : "present"),
            },
          };
        });
        showNotif(`✅ ${type === "in" ? "Check-In" : "Check-Out"} — ${displayTime}`);
      }
    );
  };

  const addActivity = () => {
    if (!activityInput.trim()) return;
    const key = `${currentUser.id}_${getToday()}`;
    setActivities((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), { text: activityInput, time: getTime(), id: Date.now() }],
    }));
    setActivityInput("");
    showNotif("Activity add ho gayi!");
  };

  const applyLeave = () => {
    if (!leaveForm.from || !leaveForm.to || !leaveForm.reason) { showNotif("Sab fields bharein!", "error"); return; }
    setLeaves((prev) => [...prev, { ...leaveForm, userId: currentUser.id, status: "pending", id: Date.now(), name: currentUser.name }]);
    setLeaveForm({ from: "", to: "", type: "annual", reason: "" });
    showNotif("Leave apply ho gayi! Approval pending hai.");
  };

  const getUserAttendance = (userId, year, month) => {
    return Object.values(attendance).filter(
      (a) => a.userId === userId && a.date?.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
    );
  };

  const getMonthStats = (userId) => {
    const recs = getUserAttendance(userId, viewMonth.year, viewMonth.month);
    const present = recs.filter((r) => r.status === "present").length;
    const late = recs.filter((r) => r.status === "late").length;
    const absent = recs.filter((r) => r.status === "absent").length;
    const deduction = late * DAILY_DEDUCTION;
    return { present, late, absent, deduction, total: recs.length };
  };

  const getDayStatus = (date) => {
    if (!currentUser) return null;
    const key = getAttKey(currentUser.id, date.toISOString().split("T")[0]);
    const rec = attendance[key];
    if (!rec) {
      const day = date.getDay();
      if (day === 0 || day === 6) return "holiday";
      return null;
    }
    return rec.status;
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c81 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "48px 40px", width: 380, boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>🏢</div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0 }}>Office Portal</h1>
            <p style={{ color: "#94a3b8", margin: "8px 0 0", fontSize: 14 }}>Apna account select karein</p>
          </div>
          {EMPLOYEES.map((emp) => (
            <button key={emp.id} onClick={() => setCurrentUser(emp)}
              style={{ width: "100%", padding: "14px 20px", marginBottom: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.3)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {emp.name[0]}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{emp.designation} • {emp.dept}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const stats = getMonthStats(currentUser.id);
  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const todayActivities = activities[`${currentUser.id}_${getToday()}`] || [];
  const myLeaves = leaves.filter(l => l.userId === currentUser.id);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "attendance", label: "Attendance", icon: "✅" },
    { id: "activity", label: "Activities", icon: "📝" },
    { id: "leave", label: "Leave", icon: "📅" },
    { id: "monthly", label: "Monthly", icon: "📆" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: notification.type === "error" ? "#ef4444" : notification.type === "warning" ? "#f59e0b" : "#10b981",
          color: "#fff", padding: "14px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", maxWidth: 320, animation: "slideIn 0.3s ease"
        }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e40af)", color: "#fff", padding: "0 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🏢</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Office Attendance Portal</div>
              <div style={{ fontSize: 11, color: "#93c5fd" }}>{currentTime.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {currentTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div style={{ fontSize: 11, color: "#93c5fd" }}>{currentUser.name}</div>
            </div>
            <button onClick={() => setCurrentUser(null)}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 4, paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? "rgba(255,255,255,0.15)" : "transparent",
                border: "none", borderBottom: activeTab === t.id ? "2px solid #60a5fa" : "2px solid transparent",
                color: activeTab === t.id ? "#fff" : "#93c5fd", padding: "12px 16px", cursor: "pointer",
                fontSize: 13, fontWeight: 600, borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 6
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Present Days", value: stats.present, icon: "✅", color: "#10b981", bg: "#d1fae5" },
                { label: "Late Days", value: stats.late, icon: "⏰", color: "#f59e0b", bg: "#fef3c7" },
                { label: "Absent Days", value: stats.absent, icon: "❌", color: "#ef4444", bg: "#fee2e2" },
                { label: "Late Deduction", value: `Rs. ${stats.deduction}`, icon: "💸", color: "#6366f1", bg: "#ede9fe" },
              ].map((s) => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderTop: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Today Status */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: 16 }}>📍 Aaj Ki Attendance — {getToday()}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: todayAtt?.checkIn ? "#d1fae5" : "#f8fafc", borderRadius: 12, padding: 16, border: `2px solid ${todayAtt?.checkIn ? "#10b981" : "#e2e8f0"}` }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Check-In</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: todayAtt?.checkIn ? "#059669" : "#94a3b8", margin: "8px 0 4px" }}>
                    {todayAtt?.checkIn || "--:--"}
                  </div>
                  {todayAtt?.isLate && <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>⚠️ Late</span>}
                  {todayAtt?.checkInLoc && <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>📍 {todayAtt.checkInLoc.lat}, {todayAtt.checkInLoc.lng}</div>}
                </div>
                <div style={{ background: todayAtt?.checkOut ? "#dbeafe" : "#f8fafc", borderRadius: 12, padding: 16, border: `2px solid ${todayAtt?.checkOut ? "#3b82f6" : "#e2e8f0"}` }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Check-Out</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: todayAtt?.checkOut ? "#1d4ed8" : "#94a3b8", margin: "8px 0 4px" }}>
                    {todayAtt?.checkOut || "--:--"}
                  </div>
                  {todayAtt?.checkOutLoc && <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>📍 {todayAtt.checkOutLoc.lat}, {todayAtt.checkOutLoc.lng}</div>}
                </div>
              </div>
            </div>

            {/* Today Activities */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: 16 }}>📝 Aaj Ki Activities</h3>
              {todayActivities.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 14 }}>Abhi koi activity nahi daali</p> :
                todayActivities.map(a => (
                  <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, minWidth: 60 }}>{a.time}</span>
                    <span style={{ fontSize: 14, color: "#334155" }}>{a.text}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === "attendance" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 8px", color: "#1e293b" }}>Attendance Mark Karein</h2>
              <p style={{ color: "#64748b", margin: "0 0 28px", fontSize: 14 }}>Office time: 9:00 AM — Late: after 9:15 AM</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <button
                  onClick={() => markAttendance("in")}
                  disabled={!!todayAtt?.checkIn}
                  style={{
                    padding: "20px", borderRadius: 16, border: "none", cursor: todayAtt?.checkIn ? "not-allowed" : "pointer",
                    background: todayAtt?.checkIn ? "#d1fae5" : "linear-gradient(135deg, #10b981, #059669)",
                    color: todayAtt?.checkIn ? "#059669" : "#fff", fontSize: 16, fontWeight: 700,
                    boxShadow: todayAtt?.checkIn ? "none" : "0 4px 20px rgba(16,185,129,0.4)", transition: "all 0.2s"
                  }}>
                  {todayAtt?.checkIn ? `✅ Check-In: ${todayAtt.checkIn}` : "🟢 Check-In Karein"}
                </button>
                <button
                  onClick={() => markAttendance("out")}
                  disabled={!todayAtt?.checkIn || !!todayAtt?.checkOut}
                  style={{
                    padding: "20px", borderRadius: 16, border: "none", cursor: (!todayAtt?.checkIn || todayAtt?.checkOut) ? "not-allowed" : "pointer",
                    background: todayAtt?.checkOut ? "#dbeafe" : todayAtt?.checkIn ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "#f1f5f9",
                    color: todayAtt?.checkOut ? "#1d4ed8" : todayAtt?.checkIn ? "#fff" : "#94a3b8",
                    fontSize: 16, fontWeight: 700, boxShadow: (todayAtt?.checkIn && !todayAtt?.checkOut) ? "0 4px 20px rgba(59,130,246,0.4)" : "none", transition: "all 0.2s"
                  }}>
                  {todayAtt?.checkOut ? `✅ Check-Out: ${todayAtt.checkOut}` : "🔴 Check-Out Karein"}
                </button>
              </div>

              {todayAtt?.isLate && (
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <strong style={{ color: "#92400e" }}>⚠️ Late Attendance!</strong>
                  <p style={{ color: "#92400e", margin: "4px 0 0", fontSize: 13 }}>Aap late aaye hain. Is mah ka deduction: <strong>Rs. {DAILY_DEDUCTION}</strong></p>
                </div>
              )}

              {locationStatus && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 13, color: "#166534" }}>📍 <strong>Location Captured:</strong> Lat: {locationStatus.lat}, Lng: {locationStatus.lng}</div>
                  <a href={`https://maps.google.com/?q=${locationStatus.lat},${locationStatus.lng}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "#16a34a", textDecoration: "none", display: "inline-block", marginTop: 4 }}>
                    🗺️ Google Maps mein dekhai (tap here)
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 6px", color: "#1e293b" }}>📝 Daily Activity Log</h2>
              <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: 14 }}>Aaj kiya kiya — likhein</p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={activityInput}
                  onChange={e => setActivityInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addActivity()}
                  placeholder="Activity likhein... (Enter press karein)"
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={addActivity}
                  style={{ padding: "12px 24px", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                  Add
                </button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>Aaj Ki Activities — {getToday()}</h3>
              {todayActivities.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                  <p>Abhi koi activity nahi. Upar likhein!</p>
                </div>
              ) : (
                <div>
                  {todayActivities.map((a, i) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 0", borderBottom: i < todayActivities.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, minWidth: 70, textAlign: "center" }}>{a.time}</div>
                      <div style={{ fontSize: 14, color: "#334155", paddingTop: 4 }}>{a.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEAVE TAB */}
        {activeTab === "leave" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 6px", color: "#1e293b" }}>📅 Leave Apply Karein</h2>
              <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: 14 }}>Chutti ki request karein</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>From Date</label>
                  <input type="date" value={leaveForm.from} onChange={e => setLeaveForm(p => ({ ...p, from: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid #e2e8f0", fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>To Date</label>
                  <input type="date" value={leaveForm.to} onChange={e => setLeaveForm(p => ({ ...p, to: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid #e2e8f0", fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Leave Type</label>
                  <select value={leaveForm.type} onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid #e2e8f0", fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }}>
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="wfh">Work From Home</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Reason</label>
                  <input value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Wajah likhen..."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid #e2e8f0", fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </div>
              <button onClick={applyLeave}
                style={{ marginTop: 16, padding: "12px 28px", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                Leave Apply Karein →
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>Meri Leave Requests</h3>
              {myLeaves.length === 0 ? <p style={{ color: "#94a3b8" }}>Koi leave apply nahi ki abhi tak</p> :
                myLeaves.map(l => (
                  <div key={l.id} style={{ padding: "14px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{l.type.toUpperCase()} — {l.reason}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{l.from} se {l.to} tak</div>
                    </div>
                    <span style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: l.status === "approved" ? "#d1fae5" : l.status === "rejected" ? "#fee2e2" : "#fef3c7",
                      color: l.status === "approved" ? "#059669" : l.status === "rejected" ? "#dc2626" : "#d97706"
                    }}>
                      {l.status === "approved" ? "✅ Approved" : l.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* MONTHLY TAB */}
        {activeTab === "monthly" && (
          <div>
            {/* Month Navigator */}
            <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setViewMonth(p => { const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700 }}>← Pehla</button>
              <h3 style={{ margin: 0, color: "#1e293b" }}>
                {new Date(viewMonth.year, viewMonth.month).toLocaleString("en-PK", { month: "long", year: "numeric" })}
              </h3>
              <button onClick={() => setViewMonth(p => { const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700 }}>Agla →</button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Present", value: stats.present, color: "#10b981" },
                { label: "Late", value: stats.late, color: "#f59e0b" },
                { label: "Absent", value: stats.absent, color: "#ef4444" },
                { label: "Deduction", value: `Rs.${stats.deduction}`, color: "#6366f1" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Calendar */}
            <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 8 }}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8", padding: "4px 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                {Array(monthDays[0].getDay()).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {monthDays.map(day => {
                  const status = getDayStatus(day);
                  const isToday = day.toISOString().split("T")[0] === getToday();
                  const bg = status ? STATUS_COLORS[status] : day.getDay() === 0 || day.getDay() === 6 ? "#f1f5f9" : "#f8fafc";
                  const col = status ? "#fff" : day.getDay() === 0 || day.getDay() === 6 ? "#94a3b8" : "#475569";
                  return (
                    <div key={day.toISOString()} style={{
                      borderRadius: 8, padding: "8px 4px", textAlign: "center", background: bg, color: col,
                      fontSize: 13, fontWeight: isToday ? 800 : 500,
                      border: isToday ? "2px solid #3b82f6" : "2px solid transparent",
                      minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
                {[
                  { color: "#10b981", label: "Present" },
                  { color: "#f59e0b", label: "Late" },
                  { color: "#ef4444", label: "Absent" },
                  { color: "#6366f1", label: "Leave" },
                  { color: "#f1f5f9", label: "Weekend" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed List */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginTop: 16 }}>
              <h3 style={{ margin: "0 0 14px", color: "#1e293b", fontSize: 15 }}>Is Mahine Ki Detail</h3>
              {getUserAttendance(currentUser.id, viewMonth.year, viewMonth.month).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Is mahine koi record nahi mila</p>
              ) : (
                getUserAttendance(currentUser.id, viewMonth.year, viewMonth.month).map((rec, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 80px 80px", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13, alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: "#334155" }}>{rec.date}</div>
                    <div style={{ color: "#10b981" }}>In: {rec.checkIn || "—"}</div>
                    <div style={{ color: "#3b82f6" }}>Out: {rec.checkOut || "—"}</div>
                    <div>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: STATUS_COLORS[rec.status] + "22", color: STATUS_COLORS[rec.status] }}>
                        {rec.status}
                      </span>
                    </div>
                    <div style={{ color: rec.isLate ? "#ef4444" : "#94a3b8", fontSize: 12 }}>{rec.isLate ? `-Rs.${DAILY_DEDUCTION}` : "—"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
