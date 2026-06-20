import { useEffect, useState } from "react";

type Props = {
  cashierName?: string;
  counterNumber?: number;
  unreadCount?: number;
  syncOnline?: boolean;
  onHistory?: () => void;
  onNotifications?: () => void;
  onHelp?: () => void;
  onLogout?: () => void;
};

export function PosNavbar({
  cashierName = "cash2",
  counterNumber = 2,
  unreadCount = 0,
  syncOnline = false,
  onHistory,
  onNotifications,
  onHelp,
  onLogout
}: Props) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="pos-nav">
      <div className="pos-nav-left">
        <div className="pos-nav-logo">POS</div>
        <div className="pos-nav-brand">
          <strong>Nausheen Fruits Juice Center</strong>
          <span>Main Branch · Desktop POS</span>
        </div>
      </div>

      <div className="pos-nav-center">
        <div className="pos-shift-pill">
          <span className="pos-shift-dot" />
          Shift Active
        </div>
        <div className="pos-nav-cashier">
          <span>👤 {cashierName}</span>
          <span className="pos-nav-counter">Counter {counterNumber}</span>
        </div>
      </div>

      <div className="pos-nav-right">
        <div className={`pos-sync-badge ${syncOnline ? "online" : "offline"}`}>
          {syncOnline ? "Cloud Online" : "Offline Mode"}
        </div>
        <div className="pos-nav-clock">🕐 {clock}</div>
        <button type="button" className="pos-nav-icon-btn" aria-label="Notifications" onClick={onNotifications}>
          🔔
          {unreadCount > 0 ? <span className="pos-nav-badge">{unreadCount}</span> : null}
        </button>
        <button type="button" className="pos-nav-icon-btn" aria-label="History" onClick={onHistory}>↻</button>
        <button type="button" className="pos-nav-icon-btn" aria-label="Help" onClick={onHelp}>?</button>
        <button type="button" className="pos-nav-logout" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
