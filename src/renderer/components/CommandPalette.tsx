import { useEffect, useMemo, useRef, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { commandItems } from "../app/navigation";

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = useMemo(
    () => commandItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
    [query],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input-row">
          <Search size={18} />
          <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search screens and commands…" />
          <button onClick={onClose} aria-label="Close command palette"><X size={16} /></button>
        </div>
        <div className="command-results">
          <div className="eyebrow">Available commands</div>
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <button key={`${item.label}-${item.path}`} onClick={() => { navigate(item.path); onClose(); }}>
                <Icon size={17} /><span>{item.label}</span><Command size={13} />
              </button>
            );
          })}
          {results.length === 0 && <div className="command-empty">No available command matches “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
