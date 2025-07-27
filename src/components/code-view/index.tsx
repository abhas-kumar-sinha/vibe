"use client";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { Sandpack } from "@codesandbox/sandpack-react";

interface Props {
  code: string;
  lang: "javascript" | "typescript" | "jsx" | "tsx" | "python";
}

export const CodeView = ({ code, lang }: Props) => {

    const currentTheme = useCurrentTheme();
  
    const languageMap: Record<
        Props["lang"],
        { fileName: string }
    > = {
        javascript: { fileName: "/index.js" },
        typescript: { fileName: "/index.ts" },
        jsx: { fileName: "/App.js" },
        tsx: { fileName: "/App.tsx" },
        python: { fileName: "/index.txt" },
    };

    const { fileName } = languageMap[lang];

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
