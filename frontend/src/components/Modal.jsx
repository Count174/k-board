import React, { useEffect } from "react";
import styles from "./Modal.module.css";

export default function Modal({ open, onClose, children, title, wide }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.window} ${wide ? styles.windowWide : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.header} ${wide ? styles.headerShrink0 : ""}`}>
          <div className={styles.title}>{title}</div>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>
        <div className={`${styles.body} ${wide ? styles.bodyWide : ""}`}>{children}</div>
      </div>
    </div>
  );
}