import { useMemo, useState, type FormEvent } from "react";
import type { StudyItem } from "../../api/types";
import type { StudyItemCreate } from "../../api/studyItems";
import { formatDayMonthYear } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";
import {
  useCreateStudyItem,
  useEditStudyItem,
  useLogInteraction,
  useStudyCategoriesQuery,
  useStudyItemsQuery,
} from "./useStudyItems";
import styles from "./study.module.css";
import formStyles from "./forms.module.css";

const CATEGORY_OPTIONS_ID = "study-category-options";

export function StudySection() {
  const { data: items } = useStudyItemsQuery();
  const { data: categories } = useStudyCategoriesQuery();
  const [categoryFilter, setCategoryFilter] = useState("");

  const visible = useMemo(() => {
    if (!items) return undefined;
    const filter = categoryFilter.trim().toLowerCase();
    const matching = filter
      ? items.filter((item) => item.category.toLowerCase().startsWith(filter))
      : items;
    return sortLeastRecentlyTouchedFirst(matching);
  }, [items, categoryFilter]);

  if (!visible) return null;
  const active = visible.filter((item) => !item.is_archived);
  const archived = visible.filter((item) => item.is_archived);

  return (
    <>
      <datalist id={CATEGORY_OPTIONS_ID}>
        {categories?.map(({ category }) => <option key={category} value={category} />)}
      </datalist>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="study-items-heading" className={styles.heading}>
            Study items
          </h2>
          <input
            className={styles.filterInput}
            type="text"
            aria-label="Filter by category"
            placeholder="Filter by category"
            list={CATEGORY_OPTIONS_ID}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          />
        </div>
        {active.length === 0 ? (
          <p className={styles.empty}>
            {categoryFilter ? "No study items in this category." : "Add your first study item."}
          </p>
        ) : (
          <ul className={styles.list} aria-labelledby="study-items-heading">
            {active.map((item) => (
              <li key={item.id} className={styles.item}>
                <StudyItemRow item={item} />
              </li>
            ))}
          </ul>
        )}
        <AddStudyItemForm />
      </section>
      {archived.length > 0 && <ArchivedStudyItems items={archived} />}
    </>
  );
}

/** All-list order per the spec: never-touched first, then oldest touch first. */
function sortLeastRecentlyTouchedFirst(items: StudyItem[]): StudyItem[] {
  return [...items].sort((a, b) => {
    const touchedA = lastTouchedMs(a);
    const touchedB = lastTouchedMs(b);
    if (touchedA === null && touchedB === null) return createdMs(a) - createdMs(b);
    if (touchedA === null) return -1;
    if (touchedB === null) return 1;
    return touchedA - touchedB;
  });
}

function lastTouchedMs(item: StudyItem): number | null {
  // last_reviewed_at counts too: legacy items whose only interactions were
  // reviews shouldn't sort as never-touched.
  const touches = [item.last_primed_at, item.last_studied_at, item.last_reviewed_at]
    .filter((iso): iso is string => typeof iso === "string")
    .map((iso) => Date.parse(iso));
  return touches.length > 0 ? Math.max(...touches) : null;
}

function createdMs(item: StudyItem): number {
  return item.created_at ? Date.parse(item.created_at) : 0;
}

function ArchivedStudyItems({ items }: { items: StudyItem[] }) {
  const editMutation = useEditStudyItem();
  return (
    <section className={styles.section}>
      <h2 id="archived-study-items-heading" className={styles.heading}>
        Archived study items
      </h2>
      <ul className={styles.list} aria-labelledby="archived-study-items-heading">
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.archivedName}>{item.prompt}</span>
            </div>
            <button
              className={styles.moreAction}
              type="button"
              aria-label={`Restore ${item.prompt}`}
              disabled={!isSettled(item.id)}
              onClick={() => editMutation.mutate({ id: item.id, patch: { is_archived: false } })}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudyItemRow({ item }: { item: StudyItem }) {
  const [editing, setEditing] = useState(false);
  const editMutation = useEditStudyItem();
  const logMutation = useLogInteraction();
  const settled = isSettled(item.id);

  if (editing) {
    return (
      <StudyItemForm
        idPrefix={`edit-study-item-${item.id}`}
        initial={item}
        onSubmit={({ draft, imageFile, removeImage }) => {
          editMutation.mutate({ id: item.id, patch: draft, imageFile, removeImage });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      {item.image_url && <img className={styles.thumb} src={item.image_url} alt="" />}
      <div className={styles.main}>
        <div className={styles.titleLine}>
          <h3 className={styles.name}>{item.prompt}</h3>
          {item.category && <span className={styles.chip}>{item.category}</span>}
        </div>
        {item.notes && <p className={styles.notes}>{item.notes}</p>}
        <div className={styles.stats}>
          <InteractionStat
            noun="prime"
            plural="primes"
            count={item.prime_count}
            first={item.first_primed_at}
            last={item.last_primed_at}
          />
          <InteractionStat
            noun="study"
            plural="studies"
            count={item.study_count}
            first={item.first_studied_at}
            last={item.last_studied_at}
          />
        </div>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.logButton}
          type="button"
          aria-label={`Log prime for ${item.prompt}`}
          disabled={!settled}
          onClick={() => logMutation.mutate({ id: item.id, kind: "prime" })}
        >
          Prime
        </button>
        <button
          className={styles.logButton}
          type="button"
          aria-label={`Log study for ${item.prompt}`}
          disabled={!settled || !item.notes.trim()}
          onClick={() => logMutation.mutate({ id: item.id, kind: "study" })}
        >
          Study
        </button>
        <RowMenu
          name={item.prompt}
          disabled={!settled}
          items={[
            { label: "Edit", onSelect: () => setEditing(true) },
            {
              label: "Archive",
              onSelect: () => editMutation.mutate({ id: item.id, patch: { is_archived: true } }),
            },
          ]}
        />
      </div>
    </>
  );
}

/** "3 primes" with the first-ever and most-recent dates as a tooltip. */
function InteractionStat({
  noun,
  plural,
  count,
  first,
  last,
}: {
  noun: string;
  plural: string;
  count: number;
  first: string | null;
  last: string | null;
}) {
  const history =
    first && last
      ? `First ${noun} ${formatDayMonthYear(first)} · Last ${noun} ${formatDayMonthYear(last)}`
      : undefined;
  return (
    <span className={styles.stat} title={history}>
      {count} {count === 1 ? noun : plural}
    </span>
  );
}

function AddStudyItemForm() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateStudyItem();

  if (!open) {
    return (
      <button className={formStyles.openButton} type="button" onClick={() => setOpen(true)}>
        Add study item
      </button>
    );
  }

  return (
    <StudyItemForm
      idPrefix="add-study-item"
      onSubmit={({ draft, imageFile }) => {
        createMutation.mutate({ draft, imageFile });
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

interface StudyItemFormResult {
  draft: StudyItemCreate;
  imageFile?: File;
  removeImage?: boolean;
}

/** Title/notes/category/image form shared by add (no initial) and edit. */
function StudyItemForm({
  idPrefix,
  initial,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial?: StudyItem;
  onSubmit: (result: StudyItemFormResult) => void;
  onCancel: () => void;
}) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [imageFile, setImageFile] = useState<File | undefined>(undefined);
  const [removeImage, setRemoveImage] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    // Category keeps the typed case: autocomplete offers existing values
    // verbatim, and rewriting them would fork the category.
    onSubmit({
      draft: { prompt: trimmed, notes: notes.trim(), category: category.trim() },
      imageFile,
      removeImage: removeImage && !imageFile,
    });
  }

  return (
    <form className={initial ? formStyles.rowForm : formStyles.form} onSubmit={handleSubmit}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          className={formStyles.nameInput}
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-notes`}>
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          className={formStyles.notesInput}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-category`}>
          Category
        </label>
        <input
          id={`${idPrefix}-category`}
          className={formStyles.input}
          type="text"
          list={CATEGORY_OPTIONS_ID}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-image`}>
          Image
        </label>
        <input
          id={`${idPrefix}-image`}
          className={formStyles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => setImageFile(event.target.files?.[0])}
        />
      </div>
      {initial?.image_url && !imageFile && (
        <label className={formStyles.removeImage}>
          <input
            type="checkbox"
            checked={removeImage}
            onChange={(event) => setRemoveImage(event.target.checked)}
          />
          Remove image
        </label>
      )}
      <button className={formStyles.saveButton} type="submit">
        Save
      </button>
      <button className={formStyles.cancelButton} type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
