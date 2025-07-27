"use client";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { Editor } from "@monaco-editor/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button"; // Adjust import based on your UI library

interface Props {
  code: string;
  lang: string;
  onCodeChange?: (newCode: string) => void;
  onSave?: (code: string) => void;
}

export const CodeView = ({ code, lang, onCodeChange, onSave }: Props) => {
  const currentTheme = useCurrentTheme();
  const [currentCode, setCurrentCode] = useState(code);
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef(null);

  // Update internal state when code prop changes (file switching)
  useEffect(() => {
    setCurrentCode(code);
    setHasChanges(false);
  }, [code]);

  // Map your language codes to Monaco's language identifiers
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    mjs: "javascript",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    // Add more as needed
  };

  const monacoLanguage = languageMap[lang] || "typescript";
  const isTypeScript = monacoLanguage === "typescript";

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || "";
    setCurrentCode(newCode);
    setHasChanges(newCode !== code);
    onCodeChange?.(newCode);
  };

  const handleSave = async () => {
    try {
      await onSave?.(currentCode);
      setHasChanges(false);
      // You could add a toast notification here for successful save
    } catch (error) {
      console.error("Failed to save code:", error);
      // Handle error (show toast, etc.)
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configure TypeScript settings
    if (monaco && monaco.languages && monaco.languages.typescript) {
      // More permissive TypeScript configuration
      const compilerOptions = {
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noImplicitAny: false,
        strictNullChecks: false,
        strictFunctionTypes: false,
        strictBindCallApply: false,
        strictPropertyInitialization: false,
        noImplicitReturns: false,
        noImplicitThis: false,
        alwaysStrict: false,
        allowUnreachableCode: true,
        allowUnusedLabels: true,
        downlevelIteration: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        isolatedModules: false,
      };

      // Apply to both TypeScript and JavaScript
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
        compilerOptions,
      );
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
        compilerOptions,
      );

      // Reduce error reporting for a smoother editing experience
      const diagnosticsOptions = {
        noSemanticValidation: false, // Keep semantic validation for TS
        noSyntaxValidation: false,
        noSuggestionDiagnostics: true,
        diagnosticCodesToIgnore: [
          1005, // expected token
          1109, // expression expected
          1005, // ')' expected
          1002, // unterminated string
          1003, // identifier expected
          2304, // cannot find name
          2307, // cannot find module
          2552, // cannot find name, did you mean
          2580, // cannot find name, did you mean
          7016, // could not find declaration file
          7006, // parameter implicitly has an any type
        ],
      };

      if (isTypeScript) {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
          diagnosticsOptions,
        );
      } else {
        // For JavaScript files, be more lenient
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: true,
        });
      }
    }

    // Add keyboard shortcut for save (Ctrl+S / Cmd+S)
    if (editor && monaco && monaco.KeyMod && monaco.KeyCode) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (hasChanges) {
          handleSave();
        }
      });
    }
  };

  return (
    <div className="relative">
      <Editor
        height="562px"
        language={monacoLanguage}
        value={currentCode}
        theme={currentTheme === "dark" ? "vs-dark" : "light"}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: false,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
          },
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
        }}
      />

      {hasChanges && (
        <div className="absolute top-2 right-2 z-10">
          <Button onClick={handleSave} size="sm" className="shadow-lg">
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
};
