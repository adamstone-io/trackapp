import { Action, ActionPanel, Detail, LocalStorage, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchCategories, fetchNextItem, logInteraction, StudyItem, StudyMode } from "./api";

export default function StudyCommand() {
  const [mode, setMode] = useState<StudyMode>("priming");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);
  const [item, setItem] = useState<StudyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const label = mode === "priming" ? "Primed" : "Studied";

  async function loadNext(m?: StudyMode, cat?: string | undefined) {
    setLoading(true);
    setError(null);
    setShowNotes(false);
    try {
      const next = await fetchNextItem(m ?? mode, cat !== undefined ? cat : category);
      setItem(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      // non-critical
    }
  }

  function switchMode() {
    const next: StudyMode = mode === "priming" ? "studying" : "priming";
    setMode(next);
    setCategory(undefined);
    LocalStorage.setItem("study-mode", next);
    LocalStorage.removeItem("study-category");
    loadNext(next, undefined);
  }

  function filterCategory(cat: string | undefined) {
    setCategory(cat);
    if (cat) {
      LocalStorage.setItem("study-category", cat);
    } else {
      LocalStorage.removeItem("study-category");
    }
    loadNext(undefined, cat);
  }

  useEffect(() => {
    (async () => {
      const savedMode = await LocalStorage.getItem<string>("study-mode");
      const savedCategory = await LocalStorage.getItem<string>("study-category");
      const m = (savedMode === "studying" ? "studying" : "priming") as StudyMode;
      const c = savedCategory || undefined;
      setMode(m);
      setCategory(c);
      setInitialized(true);
      loadNext(m, c);
      loadCategories();
    })();
  }, []);

  if (error) {
    return <Detail markdown={`## Error\n\n${error}`} />;
  }

  if (!loading && !item) {
    return (
      <Detail
        markdown={`## No ${mode} items${category ? ` in "${category}"` : ""}\n\nAll caught up!`}
        actions={
          <ActionPanel>
            <Action title={`Switch to ${mode === "priming" ? "Studying" : "Priming"}`} onAction={switchMode} />
            {category && <Action title="Clear Category Filter" onAction={() => filterCategory(undefined)} />}
          </ActionPanel>
        }
      />
    );
  }

  const hasNotes = !!(item?.notes || item?.note_image_url);
  const markdown = buildMarkdown(item, showNotes);

  return (
    <Detail
      isLoading={loading}
      markdown={markdown}
      metadata={
        item ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Note" text={hasNotes ? "Yes" : "No"} />
            <Detail.Metadata.Label title="Count" text={String(mode === "priming" ? item.prime_count : item.study_count)} />
            <Detail.Metadata.Label
              title={mode === "priming" ? "Last Primed" : "Last Studied"}
              text={formatDate(mode === "priming" ? item.last_primed_at : item.last_studied_at)}
            />
            <Detail.Metadata.Label
              title={mode === "priming" ? "First Primed" : "First Studied"}
              text={formatDate(mode === "priming" ? item.first_primed_at : item.first_studied_at)}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Mode" text={mode === "priming" ? "Priming" : "Studying"} />
            <Detail.Metadata.Label title="Filter" text={category || "All"} />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        item ? (
          <ActionPanel>
            <Action
              title={`Mark as ${label} & Next`}
              onAction={async () => {
                await logInteraction(item.id);
                await showToast({ style: Toast.Style.Success, title: `${label}!` });
                loadNext();
              }}
            />
            {hasNotes && (
              <Action
                title={showNotes ? "Hide Notes" : "Show Notes"}
                onAction={() => setShowNotes(!showNotes)}
              />
            )}
            <Action title="Skip (Next)" onAction={loadNext} />
            <Action
              title={`Switch to ${mode === "priming" ? "Studying" : "Priming"}`}
              onAction={switchMode}
            />
            <ActionPanel.Submenu title="Filter by Category">
              <Action title="All Categories" onAction={() => filterCategory(undefined)} />
              {categories.map((cat) => (
                <Action key={cat} title={cat} onAction={() => filterCategory(cat)} />
              ))}
            </ActionPanel.Submenu>
          </ActionPanel>
        ) : undefined
      }
    />
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

function buildMarkdown(item: StudyItem | null, showNotes: boolean): string {
  if (!item) return "";

  let md = "";

  if (item.prompt) {
    md += `## ${item.prompt}\n\n`;
  }

  if (item.image_url) {
    md += `![](${item.image_url})\n\n`;
  }

  if (showNotes) {
    if (item.notes) {
      md += "---\n\n" + item.notes + "\n\n";
    }
    if (item.note_image_url) {
      md += `![notes](${item.note_image_url})\n\n`;
    }
  }

  return md || "*No content*";
}
