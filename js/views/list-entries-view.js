// js/views/list-entries-view.js
import { formatTime } from "../utils/time.js";

function byId(id) {
    return document.getElementById(id);
}

function listEl() {
    const el = byId("entries-list");
    if (!el) {
        throw new Error("EntriesView: missing #entries-list");
    }
    return el;
}

function emptyEl() {
    return byId("entries-empty");
}

function isTimelineItem(value) {
    return (
        value &&
        typeof value === "object" &&
        typeof value.kind === "string" &&
        ("entry" in value || "moment" in value)
    );
}

function computeDurationSeconds(entry) {
    if (!entry) return 0;

    if (Number.isFinite(entry.durationSeconds)) return entry.durationSeconds;

    if (!entry.startedAt || !entry.endedAt) return 0;

    const start = new Date(entry.startedAt).getTime();
    const end = new Date(entry.endedAt).getTime();
    const diff = Math.round((end - start) / 1000);

    return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function formatTimeRange(entry) {
    const start = entry?.startedAt ? new Date(entry.startedAt) : null;
    const end = entry?.endedAt ? new Date(entry.endedAt) : null;

    if (!start) return "";

    const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });

    if (!end) return fmt.format(start);

    return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
}

function renderEntry(entry) {
    if (!entry) return "";

    const title = (entry.taskTitle ?? "Untitled Task").trim() || "Untitled Task";
    const durationSeconds = computeDurationSeconds(entry);
    const durationLabel = formatTime(durationSeconds);
    const timeRange = formatTimeRange(entry);

    return `
        <div class="entry-card" data-entry-id="${escapeHtml(entry.id ?? "")}">
            <div class="entry-card__header">
                <span class="entry-card__title">${escapeHtml(title)}</span>
                <span class="entry-card__duration">${escapeHtml(durationLabel)}</span>
            </div>

            <div class="entry-card__meta">
                ${timeRange ? `<span class="entry-card__time">${escapeHtml(timeRange)}</span>` : ""}
                <span>
                <button
                    class="icon-btn entry-card__menu-btn"
                    type="button"
                    aria-label="Entry options"
                    data-entry-menu
                >
                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="2" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="14" r="1.5" />
                    </svg>
                </button>
                </span>
            </div>
        </div>
    `;
}

function renderMoment(moment) {
    if (!moment) return "";

    const description = (moment.description ?? "").trim();
    const createdAt = Number.isFinite(moment.timestampMs) ? new Date(moment.timestampMs) : moment.createdAt ? new Date(moment.createdAt) : null;

    const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });

    const timeLabel = createdAt ? fmt.format(createdAt) : "";

    return `
        <div class="entry-card" data-moment-id="${escapeHtml(moment.id ?? "")}">
            <div class="enty-card__header">
            <div class="entry-card__title">${description}</div>
            <div class="entry-card__meta">
            ${
        timeLabel
            ? `<span class="entry-card__time">${escapeHtml(timeLabel)}
               </span>`
            : ""
    }          <span>
                <button
                    class="icon-btn entry-card__menu-btn"
                    type="button"
                    aria-label="Moment options"
                    data-moment-menu
                >
                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="2" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="14" r="1.5" />
                    </svg>
                </button>
            </span>
</div>
            </div>
        </div>
    `;
}

function renderItem(item) {
    if (!item) return "";

    if (item.kind === "moment") {
        return renderMoment(item.moment);
    }

    const entry = item.kind === "entry" ? item.entry : item;

    return renderEntry(entry);
}

function coerceToRenderableItems(items) {
    const arr = Array.isArray(items) ? items : [];

    return arr
        .filter(Boolean)
        .map((item) => {
            if (isTimelineItem(item)) return item;

            return { kind: "entry", entry: item };
        });
}

export const EntriesView = {
    list() {
        return listEl();
    },

    render(items) {
        const list = listEl();
        const empty = emptyEl();

        const renderables = coerceToRenderableItems(items);

        renderables.sort((a, b) => {
            const aMs =
  a.kind === "moment"
    ? Number.isFinite(a.moment?.timestampMs)
      ? a.moment.timestampMs
      : new Date(a.moment?.createdAt ?? 0).getTime()
    : new Date(a.entry?.startedAt ?? 0).getTime();

const bMs =
  b.kind === "moment"
    ? Number.isFinite(b.moment?.timestampMs)
      ? b.moment.timestampMs
      : new Date(b.moment?.createdAt ?? 0).getTime()
    : new Date(b.entry?.startedAt ?? 0).getTime();

            return bMs - aMs;
        });

        if (renderables.length === 0) {
            list.innerHTML = "";
            if (empty) empty.style.display = "block";
            return;
        }

        if (empty) empty.style.display = "none";

        list.innerHTML = renderables.map(renderItem).join("");
    },
};
