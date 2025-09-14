import { languages } from "@excalidraw/excalidraw/i18n";
import React from "react";

import { useAppLangCode } from "./language-state";

export const LanguageList = ({ style }: { style?: React.CSSProperties }) => {
  const [langCode, setLangCode] = useAppLangCode();

  return (
    <select
      className="dropdown-select dropdown-select__language"
      onChange={({ target }) => setLangCode(target.value)}
      value={langCode}
      aria-label="Select language"
      style={style}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
};
