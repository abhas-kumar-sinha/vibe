"use client";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { Sandpack } from "@codesandbox/sandpack-react";

interface Props {
  code: string;
  lang: string; // made flexible
}

export const CodeView = ({ code, lang }: Props) => {
  const currentTheme = useCurrentTheme();

  const languageMap: Record<string, { fileName: string }> = {
    js: { fileName: "/index.js" },
    ts: { fileName: "/index.ts" },
    jsx: { fileName: "/App.js" },
    tsx: { fileName: "/App.tsx" },
    py: { fileName: "/index.txt" },
    json: { fileName: "/package.json" },
    mjs: { fileName: "/index.mjs" },
    html: { fileName: "/index.html" },
    // Add more supported mappings as needed
  };

  const fallbackFileName = "/index.ts";

  const fileName = languageMap[lang]?.fileName || fallbackFileName;

  return (
    <Sandpack
      template="nextjs"
      theme={currentTheme}
      options={{
        showLineNumbers: true,
        showTabs: false,
        editorHeight: 562,
        showConsole: false,
        wrapContent: true,
        editorWidthPercentage: 100,
      }}
      files={{
        [fileName]: {
          code,
          active: true,
        },
      }}
    />
  );
};
