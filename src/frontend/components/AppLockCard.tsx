"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";
import {
  clearPin,
  getAutoLockMinutes,
  hasLocalPin,
  setAutoLockMinutes,
  setPin,
  touchActivity,
  verifyLocalPin,
} from "@/frontend/lib/lock";

export default function AppLockCard() {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(1);
  const [current, setCurrent] = useState("");
  const [pin, setPinValue] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setEnabled(await hasLocalPin());
      setMinutes(await getAutoLockMinutes());
    })();
  }, []);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  async function save() {
    setMsg("");
    if (!/^\d{4,8}$/.test(pin)) return setMsg("PIN must be 4-8 digits");
    if (pin !== pin2) return setMsg("PINs do not match");
    setBusy(true);
    try {
      if (enabled && !(await verifyLocalPin(current))) return setMsg("Current PIN is incorrect");
      await setPin(pin);
      await touchActivity();
      setEnabled(true);
      setCurrent("");
      setPinValue("");
      setPin2("");
      setMsg(enabled ? "PIN changed" : "App lock is ON");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setMsg("");
    setBusy(true);
    try {
      if (!(await verifyLocalPin(current))) return setMsg("Enter your current PIN to turn off");
      await clearPin();
      setEnabled(false);
      setCurrent("");
      setMsg("App lock is OFF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="App lock">
      <div className="space-y-3">
        <p className="text-xs text-[#94A3B8]">
          Status: <span className={enabled ? "text-[#22C55E]" : "text-[#F59E0B]"}>{enabled ? "ON" : "OFF"}</span>. The
          PIN is checked on this device, so it works offline. It blocks access to the app screen; it does not
          encrypt the data stored on the device.
        </p>
        {enabled && (
          <div>
            <label className="label">Current PIN</label>
            <input
              type="password"
              inputMode="numeric"
              className="input"
              value={current}
              onChange={(e) => setCurrent(digits(e.target.value))}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{enabled ? "New PIN" : "PIN (4-8 digits)"}</label>
            <input
              type="password"
              inputMode="numeric"
              className="input"
              value={pin}
              onChange={(e) => setPinValue(digits(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              className="input"
              value={pin2}
              onChange={(e) => setPin2(digits(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label">Auto-lock</label>
          <select
            className="input"
            value={minutes}
            onChange={async (e) => {
              const m = Number(e.target.value);
              setMinutes(m);
              await setAutoLockMinutes(m);
            }}
          >
            <option value={0}>Immediately when I leave the app</option>
            <option value={1}>After 1 minute</option>
            <option value={5}>After 5 minutes</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-primary flex-1" disabled={busy} onClick={save}>
            {enabled ? "Change PIN" : "Turn on app lock"}
          </button>
          {enabled && (
            <button className="btn btn-ghost" disabled={busy} onClick={turnOff}>
              Turn off
            </button>
          )}
        </div>
        {msg && <p className="text-sm text-[#38BDF8]">{msg}</p>}
      </div>
    </Card>
  );
}
