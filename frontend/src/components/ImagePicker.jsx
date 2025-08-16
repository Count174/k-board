import React, { useEffect, useMemo, useState } from "react";
import styles from "./ImagePicker.module.css";

export default function ImagePicker({ value, onChange, titleHint }) {
  const [mode, setMode] = useState("keyword");            // keyword | url
  const [keyword, setKeyword] = useState("");
  const [url, setUrl] = useState("");

  // автоподставим ключевое слово из названия цели
  useEffect(() => {
    if (titleHint && !keyword) {
      const k = titleHint.trim().toLowerCase();
      if (k) setKeyword(k);
    }
  }, [titleHint, keyword]);

  const finalUrl = useMemo(() => {
    if (mode === "url" && url) return url.trim();
    if (keyword) {
      const q = encodeURIComponent(keyword);
      // Unsplash Source — без ключа, всегда отдаёт картинку по теме
      return `https://source.unsplash.com/800x400/?${q}`;
    }
    return "";
  }, [mode, keyword, url]);

  useEffect(() => {
    onChange?.(finalUrl || "");
  }, [finalUrl, onChange]);

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        <button
          className={mode === "keyword" ? styles.active : ""}
          onClick={() => setMode("keyword")}
        >
          По ключу
        </button>
        <button
          className={mode === "url" ? styles.active : ""}
          onClick={() => setMode("url")}
        >
          Вставить URL
        </button>
      </div>

      {mode === "keyword" ? (
        <input
          className={styles.input}
          placeholder="например: money, gym, book, travel"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      ) : (
        <input
          className={styles.input}
          placeholder="https://example.com/image.jpg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}

      <div className={styles.preview}>
        {finalUrl ? (
          <img src={finalUrl} alt="preview" />
        ) : (
          <div className={styles.placeholder}>Превью будет здесь</div>
        )}
      </div>
      <div className={styles.hint}>
        💡 Источник картинок — Unsplash Source. Можно сразу сохранить — мы
        запишем ссылку в поле image цели.
      </div>
    </div>
  );
}