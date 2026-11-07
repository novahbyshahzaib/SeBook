"use client";
import { useEffect } from "react";

// Registers the SeBook service worker so the app can be installed
// (Add to Home screen) and open standalone, without the browser header.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
