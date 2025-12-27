"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type HistoryEntry = {
  id: string;
  label: string;
  code: string;
  createdAt: number;
};

const SAMPLE_CODE = `using System;
using System.Collections.Generic;

namespace TaskPlanner
{
    public class Planner
    {
        private readonly List<string> _tasks = new();

        public void AddTask(string description)
        {
            if (string.IsNullOrWhiteSpace(description))
            {
                throw new ArgumentException("Description cannot be empty.", nameof(description));
            }

            _tasks.Add(description);
        }

        public void Print()
        {
            foreach (var task in _tasks)
            {
                Console.WriteLine(task);
            }
        }
    }
}
`;

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ensureUsingSystem = (code: string) =>
  code.includes("using System;") ? code : `using System;\n${code}`;

const renameIdentifier = (code: string, from: string, to: string) => {
  if (!from.trim() || !to.trim() || from === to) {
    return code;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(from.trim())}\\b`, "g");
  return code.replace(pattern, to.trim());
};

const insertNullGuard = (
  code: string,
  parameter: string,
  methodName?: string,
) => {
  if (!parameter.trim()) {
    return code;
  }

  const safeParameter = parameter.trim();
  const methodPattern = new RegExp(
    `((?:public|private|protected|internal)\\s+(?:static\\s+)?(?:async\\s+)?[\\w<>\\[\\]]+\\s+${
      methodName ? escapeRegExp(methodName.trim()) : "\\w+"
    }\\s*\\([^)]*\\b${escapeRegExp(safeParameter)}\\b[^)]*\\)\\s*\\{)`,
    "m",
  );

  const match = methodPattern.exec(code);

  if (!match) {
    return code;
  }

  const insertAt = match.index + match[1].length;
  const guard = `\n        if (${safeParameter} is null)\n        {\n            throw new ArgumentNullException(nameof(${safeParameter}));\n        }\n`;
  const updated = `${code.slice(0, insertAt)}${guard}${code.slice(insertAt)}`;

  return ensureUsingSystem(updated);
};

const wrapInRegion = (code: string, regionName: string, focus?: string) => {
  if (!regionName.trim()) {
    return code;
  }

  if (!focus?.trim()) {
    return `#region ${regionName.trim()}\n${code}\n#endregion\n`;
  }

  const pattern = new RegExp(
    `(\\b${escapeRegExp(focus.trim())}\\b[\\s\\S]*?\\n\\s*\\})`,
    "m",
  );
  const match = pattern.exec(code);

  if (!match) {
    return `#region ${regionName.trim()}\n${code}\n#endregion\n`;
  }

  const body = match[0];
  const wrapped = `#region ${regionName.trim()}\n${body}\n#endregion`;
  return code.replace(pattern, wrapped);
};

const smartFormatter = (code: string) => {
  const trimmedTrailing = code
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n");

  return trimmedTrailing.replace(/\n{3,}/g, "\n\n");
};

export default function Home() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [renameFrom, setRenameFrom] = useState("Planner");
  const [renameTo, setRenameTo] = useState("TaskBoard");
  const [guardParam, setGuardParam] = useState("description");
  const [guardMethod, setGuardMethod] = useState("AddTask");
  const [regionName, setRegionName] = useState("Task Management");
  const [regionFocus, setRegionFocus] = useState("public void Print");
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: makeId(),
      label: "Estado inicial",
      code: SAMPLE_CODE,
      createdAt: Date.now(),
    },
  ]);

  const preview = useMemo(
    () => smartFormatter(code),
    [code],
  );

  const captureHistory = (label: string, nextCode: string) => {
    if (nextCode === code) {
      return;
    }

    const entry: HistoryEntry = {
      id: makeId(),
      label,
      code: nextCode,
      createdAt: Date.now(),
    };

    setCode(nextCode);
    setHistory((items) => [entry, ...items]);
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Editor asistido para C#</h1>
          <p className={styles.subtitle}>
            Aplica transformaciones frecuentes y mantén un historial de cambios
            sobre tu código C#.
          </p>
        </div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.editor}>
          <label className={styles.label} htmlFor="source">
            Código fuente
          </label>
          <textarea
            id="source"
            className={styles.textarea}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
          />
          <div className={styles.helperRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => captureHistory("Formateo rápido", smartFormatter(code))}
            >
              Formatear espacios
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                const latestOriginal = history.at(-1);
                if (latestOriginal) {
                  setCode(latestOriginal.code);
                }
              }}
            >
              Restaurar original
            </button>
          </div>
        </div>

        <aside className={styles.tools}>
          <div className={styles.toolCard}>
            <h2 className={styles.toolTitle}>Renombrar identificador</h2>
            <p className={styles.toolDescription}>
              Reemplaza todas las apariciones exactas del identificador
              seleccionado.
            </p>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="rename-from">
                Actual
              </label>
              <input
                id="rename-from"
                className={styles.input}
                value={renameFrom}
                onChange={(event) => setRenameFrom(event.target.value)}
                placeholder="Nombre actual"
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="rename-to">
                Nuevo
              </label>
              <input
                id="rename-to"
                className={styles.input}
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
                placeholder="Nombre nuevo"
              />
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() =>
                captureHistory(
                  `Renombrar ${renameFrom} → ${renameTo}`,
                  renameIdentifier(code, renameFrom, renameTo),
                )
              }
            >
              Aplicar cambio
            </button>
          </div>

          <div className={styles.toolCard}>
            <h2 className={styles.toolTitle}>Insertar guard clause</h2>
            <p className={styles.toolDescription}>
              Añade una validación de null al inicio del método indicado.
            </p>
            <div className={styles.inlineFields}>
              <label className={styles.fieldLabel} htmlFor="guard-method">
                Método
              </label>
              <input
                id="guard-method"
                className={styles.input}
                value={guardMethod}
                onChange={(event) => setGuardMethod(event.target.value)}
                placeholder="Nombre del método"
              />
            </div>
            <div className={styles.inlineFields}>
              <label className={styles.fieldLabel} htmlFor="guard-param">
                Parámetro
              </label>
              <input
                id="guard-param"
                className={styles.input}
                value={guardParam}
                onChange={(event) => setGuardParam(event.target.value)}
                placeholder="Parámetro a validar"
              />
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() =>
                captureHistory(
                  `Null-check para ${guardParam}`,
                  insertNullGuard(code, guardParam, guardMethod),
                )
              }
            >
              Insertar guard clause
            </button>
          </div>

          <div className={styles.toolCard}>
            <h2 className={styles.toolTitle}>Región estructural</h2>
            <p className={styles.toolDescription}>
              Envuélvelo en una región nombrada para mantener el código
              organizado.
            </p>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="region-name">
                Nombre de la región
              </label>
              <input
                id="region-name"
                className={styles.input}
                value={regionName}
                onChange={(event) => setRegionName(event.target.value)}
                placeholder="p. ej. Task Management"
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="region-focus">
                Texto a encapsular (opcional)
              </label>
              <input
                id="region-focus"
                className={styles.input}
                value={regionFocus}
                onChange={(event) => setRegionFocus(event.target.value)}
                placeholder="Firma del método o bloque"
              />
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() =>
                captureHistory(
                  `Región ${regionName}`,
                  wrapInRegion(code, regionName, regionFocus),
                )
              }
            >
              Crear región
            </button>
          </div>
        </aside>
      </section>

      <section className={styles.previewSection}>
        <div className={styles.preview}>
          <h2 className={styles.previewTitle}>Código resultante</h2>
          <pre className={styles.output}>
            <code>{preview}</code>
          </pre>
        </div>
        <div className={styles.history}>
          <h2 className={styles.previewTitle}>Historial</h2>
          <ul className={styles.historyList}>
            {history.map((entry) => (
              <li key={entry.id} className={styles.historyItem}>
                <button
                  type="button"
                  className={styles.historyButton}
                  onClick={() => setCode(entry.code)}
                >
                  <span className={styles.historyLabel}>{entry.label}</span>
                  <time className={styles.historyTimestamp}>
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
