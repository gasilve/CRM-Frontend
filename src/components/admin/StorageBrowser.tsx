import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ChevronLeft, ChevronRight, File, FileImage, FileText, FileVideo, Folder, Loader2, Play, RefreshCw, X } from "lucide-react";
import { ApiError, storageApi, type StagingSummary, type StorageBucketId, type StorageFile, type StorageFolder, type StorageListing } from "@/lib/crm-api";
import "./storage-browser.css";

const PANES: { id: StorageBucketId; title: string }[] = [
  { id: "staging", title: "Staging" },
  { id: "cold", title: "Cold storage" },
];

type SortKey = "name" | "modified" | "type" | "size";
type SortDir = "asc" | "desc";
type MediaKind = "video" | "audio" | "image" | "text" | "file";
type Row =
  | { kind: "folder"; name: string; prefix: string }
  | { kind: "file"; file: StorageFile };

type Playing = { bucket: StorageBucketId; bucketLabel: string; file: StorageFile };

export function StorageBrowser() {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [staging, setStaging] = useState<StagingSummary | null>(null);

  useEffect(() => {
    let live = true;
    storageApi
      .staging()
      .then((next) => {
        if (live) setStaging(next);
      })
      .catch(() => {
        if (live) setStaging(null);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="ex-stage">
      <p className="ex-feed">
        {staging == null
          ? "Checking what is still in staging."
          : staging.folders === 0
            ? "Nothing is waiting in staging."
            : `${staging.folders} ${staging.folders === 1 ? "folder" : "folders"} still in staging. ${staging.cases.map((item) => `${item.name} (${item.days.join(", ")})`).join(" · ")}`}
      </p>
      {PANES.map((pane) => (
        <Explorer key={pane.id} id={pane.id} title={pane.title} onPlay={(file) => setPlaying({ bucket: pane.id, bucketLabel: pane.title, file })} />
      ))}
      {playing && <Player playing={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function Explorer({ id, title, onPlay }: { id: StorageBucketId; title: string; onPlay: (file: StorageFile) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState({ stack: [""], index: 0 });
  const [listing, setListing] = useState<StorageListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const prefix = nav.stack[nav.index] ?? "";

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    void tick;
    storageApi
      .list(id, prefix)
      .then((next) => {
        if (live) setListing(next);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setListing(null);
        setError(err instanceof ApiError ? err.message : "Could not open this folder.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, prefix, tick]);

  useEffect(() => load(), [load]);

  const rows = useMemo(() => (listing ? buildRows(listing.folders, listing.files, sort) : []), [listing, sort]);
  const selectedRow = rows.find((row) => rowId(row) === selected) ?? null;
  const crumbs = crumbsOf(prefix, title);

  const go = (next: string) => {
    if (next === prefix) return;
    setNav((current) => {
      const stack = [...current.stack.slice(0, current.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
    setSelected(null);
  };

  const back = () => {
    setNav((current) => ({ ...current, index: Math.max(0, current.index - 1) }));
    setSelected(null);
  };
  const forward = () => {
    setNav((current) => ({ ...current, index: Math.min(current.stack.length - 1, current.index + 1) }));
    setSelected(null);
  };
  const up = () => {
    const parent = parentPrefix(prefix);
    if (parent !== prefix) go(parent);
  };

  const openRow = (row: Row) => {
    if (row.kind === "folder") go(row.prefix);
    else onPlay(row.file);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      up();
      return;
    }
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      back();
      return;
    }
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      forward();
      return;
    }
    if (rows.length === 0) return;
    const index = Math.max(0, rows.findIndex((row) => rowId(row) === selected));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? Math.min(rows.length - 1, index + (selected ? 1 : 0)) : Math.max(0, index - 1);
      setSelected(rowId(rows[next]!));
      return;
    }
    if (event.key === "Enter" && selectedRow) {
      event.preventDefault();
      openRow(selectedRow);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const count = (listing?.folders.length ?? 0) + (listing?.files.length ?? 0);
  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;
  const canUp = prefix !== "";

  return (
    <section className="ex" aria-label={title}>
      <div className="ex-toolbar">
        <div className="ex-nav">
          <button type="button" aria-label="Back" disabled={!canBack} onClick={back}>
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button type="button" aria-label="Forward" disabled={!canForward} onClick={forward}>
            <ChevronRight size={22} strokeWidth={2} />
          </button>
          <button type="button" aria-label="Up" disabled={!canUp} onClick={up}>
            <ArrowUp size={20} strokeWidth={2} />
          </button>
          <button type="button" aria-label={`Refresh ${title}`} disabled={loading} onClick={() => setTick((n) => n + 1)}>
            {loading ? <Loader2 size={18} className="ex-spin" /> : <RefreshCw size={18} strokeWidth={2} />}
          </button>
        </div>
        <div className="ex-caption">
          <h2>{title}</h2>
          {listing?.local ? (
            <p className="ex-sim">On this computer, not the live buckets</p>
          ) : (
            listing && <p>{listing.name}</p>
          )}
        </div>
        <button type="button" className="ex-play" disabled={!selectedRow} onClick={() => selectedRow && openRow(selectedRow)}>
          <Play size={16} strokeWidth={2.2} />
          {selectedRow?.kind === "folder" ? "Open" : "Play"}
        </button>
      </div>

      <nav className="ex-address" aria-label={`${title} address`}>
        {crumbs.map((crumb, index) => (
          <span key={crumb.prefix || "root"} className="ex-crumb">
            {index > 0 && <ChevronRight size={14} strokeWidth={2} aria-hidden />}
            <button type="button" title={crumb.label} onClick={() => go(crumb.prefix)} aria-current={index === crumbs.length - 1 ? "page" : undefined}>
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="ex-cols ex-head" role="row">
        <SortButton label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
        <SortButton label="Date modified" sortKey="modified" sort={sort} onSort={toggleSort} />
        <SortButton label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
        <SortButton label="Size" sortKey="size" sort={sort} onSort={toggleSort} />
      </div>

      <div ref={listRef} className="ex-list" tabIndex={0} role="listbox" aria-label={title} onKeyDown={onKeyDown} onClick={() => setSelected(null)}>
        {loading && <div className="ex-progress" />}
        {error && <p className="ex-empty bad">{error}</p>}
        {!error && !loading && rows.length === 0 && <p className="ex-empty">This folder is empty.</p>}
        {!error && loading && !listing && <p className="ex-empty">Opening this folder…</p>}
        {rows.map((row) => {
          const id = rowId(row);
          const on = id === selected;
          const name = row.kind === "folder" ? row.name : row.file.name;
          return (
            <div
              key={id}
              role="option"
              aria-selected={on}
              className={on ? "ex-row on" : "ex-row"}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(id);
                listRef.current?.focus();
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                openRow(row);
              }}
            >
              <span className="ex-name">
                <RowIcon row={row} />
                <span title={name}>{name}</span>
              </span>
              <span className="ex-cell">{row.kind === "file" && row.file.modified ? formatWhen(row.file.modified) : ""}</span>
              <span className="ex-cell type">{typeLabel(name, row.kind === "folder")}</span>
              <span className="ex-cell size">{row.kind === "file" ? formatBytes(row.file.size) : ""}</span>
            </div>
          );
        })}
        {listing?.truncated && <p className="ex-more">This folder has more than what is shown.</p>}
      </div>

      <footer className="ex-status">
        <span>{selectedRow ? "1 item selected" : `${count} item${count === 1 ? "" : "s"}`}</span>
        <span>{selectedRow?.kind === "file" ? formatBytes(selectedRow.file.size) : "Double-click to open"}</span>
      </footer>
    </section>
  );
}

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const on = sort.key === sortKey;
  return (
    <button type="button" className={on ? "ex-sort on" : "ex-sort"} onClick={() => onSort(sortKey)}>
      {label}
      {on && <i aria-hidden>{sort.dir === "asc" ? "↑" : "↓"}</i>}
    </button>
  );
}

function RowIcon({ row }: { row: Row }) {
  if (row.kind === "folder") return <Folder size={22} strokeWidth={1.6} className="ic folder" />;
  const kind = mediaKind(row.file.name);
  if (kind === "video" || kind === "audio") return <FileVideo size={20} strokeWidth={1.6} className="ic video" />;
  if (kind === "image") return <FileImage size={20} strokeWidth={1.6} className="ic image" />;
  if (kind === "text") return <FileText size={20} strokeWidth={1.6} className="ic text" />;
  return <File size={20} strokeWidth={1.6} className="ic file" />;
}

function Player({ playing, onClose }: { playing: Playing; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const kind = mediaKind(playing.file.name);

  useEffect(() => {
    let live = true;
    setUrl(null);
    setError(null);
    setMediaError(false);
    storageApi
      .open(playing.bucket, playing.file.key)
      .then((opened) => {
        if (live) setUrl(opened.url);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof ApiError ? err.message : "Could not open that file.");
      });
    return () => {
      live = false;
    };
  }, [playing.bucket, playing.file.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="ex-player-layer" role="presentation">
      <button type="button" className="ex-player-veil" aria-label="Close" onClick={onClose} />
      <div className="ex-player" role="dialog" aria-modal="true" aria-label={playing.file.name}>
        <header className="ex-player-title">
          <div>
            <strong>{playing.file.name}</strong>
            <span>
              {playing.bucketLabel} · {formatBytes(playing.file.size)}
            </span>
          </div>
          <button type="button" className="ex-player-close" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="ex-player-body">
          {error && <p className="ex-empty bad">{error}</p>}
          {!error && !url && <p className="ex-empty">Opening…</p>}
          {url && !mediaError && kind === "video" && (
            <video src={url} controls autoPlay playsInline onError={() => setMediaError(true)} />
          )}
          {url && !mediaError && kind === "audio" && <audio src={url} controls autoPlay onError={() => setMediaError(true)} />}
          {url && !mediaError && kind === "image" && <img src={url} alt={playing.file.name} />}
          {url && !mediaError && (kind === "text" || kind === "file") && <TextPreview url={url} name={playing.file.name} />}
          {url && mediaError && (
            <div className="ex-empty">
              <p>This browser can’t play that file.</p>
              <a href={url} target="_blank" rel="noreferrer">
                Open it in a new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TextPreview({ url, name }: { url: string; name: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("unreadable");
        return res.text();
      })
      .then((body) => {
        if (live) setText(body.slice(0, 20000));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [url]);

  if (failed) {
    return (
      <div className="ex-empty">
        <p>{name}</p>
        <a href={url} target="_blank" rel="noreferrer">
          Open it in a new tab
        </a>
      </div>
    );
  }
  if (text == null) return <p className="ex-empty">Opening…</p>;
  return <pre className="ex-text">{text}</pre>;
}

function buildRows(folders: StorageFolder[], files: StorageFile[], sort: { key: SortKey; dir: SortDir }): Row[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const folderRows = [...folders]
    .sort((a, b) => byName(a.name, b.name) * (sort.key === "name" ? dir : 1))
    .map((folder): Row => ({ kind: "folder", name: folder.name, prefix: folder.prefix }));
  const fileRows = [...files]
    .sort((a, b) => {
      if (sort.key === "size") return (a.size - b.size) * dir || byName(a.name, b.name);
      if (sort.key === "modified") return ((a.modified ?? "").localeCompare(b.modified ?? "")) * dir || byName(a.name, b.name);
      if (sort.key === "type") return (typeLabel(a.name, false).localeCompare(typeLabel(b.name, false)) || byName(a.name, b.name)) * dir;
      return byName(a.name, b.name) * dir;
    })
    .map((file): Row => ({ kind: "file", file }));
  return [...folderRows, ...fileRows];
}

function rowId(row: Row): string {
  return row.kind === "folder" ? `d:${row.prefix}` : `f:${row.file.key}`;
}

function crumbsOf(prefix: string, rootLabel: string): { label: string; prefix: string }[] {
  const crumbs = [{ label: rootLabel, prefix: "" }];
  let built = "";
  for (const part of prefix.split("/").filter(Boolean)) {
    built += `${part}/`;
    crumbs.push({ label: part, prefix: built });
  }
  return crumbs;
}

function parentPrefix(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `${parts.join("/")}/` : "";
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function mediaKind(name: string): MediaKind {
  const ext = extOf(name);
  if (["mp4", "m4v", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["json", "txt", "log"].includes(ext)) return "text";
  return "file";
}

function typeLabel(name: string, folder: boolean): string {
  if (folder) return "File folder";
  const ext = extOf(name);
  const known: Record<string, string> = {
    mp4: "MP4 Video",
    m4v: "MP4 Video",
    mov: "QuickTime Movie",
    webm: "WebM Video",
    mkv: "Matroska Video",
    avi: "AVI Video",
    mp3: "MP3 Audio",
    wav: "WAV Audio",
    m4a: "M4A Audio",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    png: "PNG Image",
    gif: "GIF Image",
    webp: "WebP Image",
    json: "JSON File",
    txt: "Text File",
  };
  return known[ext] ?? (ext ? `${ext.toUpperCase()} File` : "File");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
