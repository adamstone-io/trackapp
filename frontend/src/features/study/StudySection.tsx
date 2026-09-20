import { useState, type FormEvent } from "react";
import type { StudyItem } from "../../api/types";
import type { StudyItemCreate } from "../../api/studyItems";
import { formatDayMonthYear, formatDaysAgo } from "../../lib/time";
import { isSettled } from "../../lib/optimistic";
import { useDebounced } from "../../lib/useDebounced";
import { RowMenu } from "../../components/RowMenu";
import { useScrollSentinel } from "./useScrollSentinel";
import {
  type StudyImageChange,
  type StudyImageChanges,
  type StudyList,
  useCreateStudyItem,
  useEditStudyItem,
  useLogInteraction,
  useStudyCategoriesQuery,
  useStudyList,
} from "./useStudyItems";
import styles from "./study.module.css";
import formStyles from "./forms.module.css";

const CATEGORY_OPTIONS_ID = "study-category-options";

/** What to call an item in menus and button labels. An image prompt has no
 * text to borrow, so it falls back the way quick moments do. */
function itemLabel(item: StudyItem): string {
  return item.prompt.trim() || "Untitled";
}

/** Long enough that spelling a category is one request, short enough that
 * the list still feels like it narrows as you type. */
const FILTER_DEBOUNCE_MS = 250;

export function StudySection() {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  // The filter is the server's business now, so it waits for the typing to
  // stop rather than sending a request per keystroke.
  const category = useDebounced(categoryFilter.trim(), FILTER_DEBOUNCE_MS);
  const { data: categories } = useStudyCategoriesQuery();
  // Two lists on screen, two paged queries: interleaving them in one stream
  // would drag pages of archived rows through the active list.
  const active = useStudyList({ category, archived: false });
  const archived = useStudyList({ category, archived: true });

  return (
    <>
      <datalist id={CATEGORY_OPTIONS_ID}>
        {categories?.map(({ category }) => <option key={category} value={category} />)}
      </datalist>
      <section className={styles.section}>
        {/* No heading — the highlighted nav link names the page. */}
        <div className={styles.sectionHead}>
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
        {/* Above the list: with a long list, adding an item shouldn't mean
            scrolling past everything you already have. */}
        <AddStudyItemForm />
        {/* The filter box and the add form render while the first page is in
            flight. Waiting for rows before drawing any of the page is what
            made a large collection look like a blank screen. */}
        {active.isPending ? (
          <p className={styles.empty} role="status">
            Loading study items…
          </p>
        ) : active.items.length === 0 ? (
          <p className={styles.empty}>
            {category ? "No study items in this category." : "Add your first study item."}
          </p>
        ) : (
          <ul className={styles.list} aria-label="Study items">
            {active.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <StudyItemRow item={item} />
              </li>
            ))}
          </ul>
        )}
        <ListFoot list={active} label="study items" />
      </section>
      {archived.count > 0 && (
        <ArchivedStudyItems
          list={archived}
          open={showArchived}
          onToggle={() => setShowArchived((wasOpen) => !wasOpen)}
        />
      )}
    </>
  );
}

/**
 * The end of a paged list. It offers nothing to press: coming into view is
 * itself the request for the next page.
 */
function ListFoot({ list, label }: { list: StudyList; label: string }) {
  const sentinel = useScrollSentinel(
    list.fetchNextPage,
    list.hasNextPage && !list.isFetchingNextPage,
  );

  if (!list.hasNextPage) return null;
  return (
    <div ref={sentinel} className={styles.loadMore}>
      {list.isFetchingNextPage && (
        <p className={styles.loadingMore} role="status">{`Loading more ${label}…`}</p>
      )}
    </div>
  );
}

/**
 * Retired items, folded away. They are somewhere to go looking when you want
 * one back, not something to scroll past on the way down the active list —
 * which is what they became once the active list stopped loading whole.
 */
function ArchivedStudyItems({
  list,
  open,
  onToggle,
}: {
  list: StudyList;
  open: boolean;
  onToggle: () => void;
}) {
  const editMutation = useEditStudyItem();
  return (
    <section className={styles.section}>
      <button
        className={styles.archivedToggle}
        type="button"
        aria-expanded={open}
        aria-controls="archived-study-items"
        onClick={onToggle}
      >
        Archived study items ({list.count})
      </button>
      {open && (
        <>
          <ul
            id="archived-study-items"
            className={styles.list}
            aria-label="Archived study items"
          >
            {list.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.main}>
                  <span className={styles.archivedName}>{itemLabel(item)}</span>
                </div>
                <button
                  className={styles.moreAction}
                  type="button"
                  aria-label={`Restore ${itemLabel(item)}`}
                  disabled={!isSettled(item.id)}
                  onClick={() =>
                    editMutation.mutate({ id: item.id, patch: { is_archived: false } })
                  }
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <ListFoot list={list} label="archived study items" />
        </>
      )}
    </section>
  );
}

function StudyItemRow({ item }: { item: StudyItem }) {
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const editMutation = useEditStudyItem();
  const logMutation = useLogInteraction();
  const settled = isSettled(item.id);
  // The row is a two-sided card: the answer stays hidden until Study reveals
  // it, and the next press logs the study and puts it away again.
  const hasAnswer = Boolean(item.notes.trim() || item.note_image_url);
  const label = itemLabel(item);

  if (editing) {
    return (
      <StudyItemForm
        idPrefix={`edit-study-item-${item.id}`}
        initial={item}
        onSubmit={({ draft, images }) => {
          editMutation.mutate({ id: item.id, patch: draft, images });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <div className={styles.main}>
        {item.prompt && (
          <div className={styles.titleLine}>
            <h3 className={styles.name}>{item.prompt}</h3>
          </div>
        )}
        {item.image_url && (
          <img
            className={styles.image}
            src={item.image_url}
            alt={`Prompt image for ${label}`}
          />
        )}
        {revealed && item.notes && <p className={styles.notes}>{item.notes}</p>}
        {revealed && item.note_image_url && (
          <img
            className={styles.image}
            src={item.note_image_url}
            alt={`Note image for ${label}`}
          />
        )}
        <div className={styles.stats}>
          {/* Leads the metadata line, so categories stack in a column the eye
              can run down — the list is filtered by them. */}
          {item.category && <span className={styles.categoryChip}>{item.category}</span>}
          {item.created_at && (
            <span className={styles.stat}>Created {formatDayMonthYear(item.created_at)}</span>
          )}
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
          aria-label={`Log prime for ${label}`}
          disabled={!settled}
          onClick={() => logMutation.mutate({ id: item.id, kind: "prime" })}
        >
          Prime
        </button>
        <button
          className={styles.logButton}
          type="button"
          aria-label={
            revealed ? `Finish studying ${label}` : `Show the answer for ${label}`
          }
          disabled={!settled || !hasAnswer}
          onClick={() => {
            if (!revealed) {
              setRevealed(true);
              return;
            }
            logMutation.mutate({ id: item.id, kind: "study" });
            setRevealed(false);
          }}
        >
          {revealed ? "Done" : "Study"}
        </button>
        <RowMenu
          name={label}
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

/** "3 primes · 3 days ago", with the first-ever and most-recent dates as a tooltip. */
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
      {count} {count === 1 ? noun : plural} · {formatDaysAgo(last)}
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
      onSubmit={({ draft, images }) => {
        createMutation.mutate({ draft, images });
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

interface StudyItemFormResult {
  draft: StudyItemCreate;
  images: StudyImageChanges;
}

/** Title/notes/category/images form shared by add (no initial) and edit. */
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
  const promptImage = useImageField();
  const noteImage = useImageField();
  const initialPromptKind: AnswerKind = initial?.image_url && !initial.prompt ? "image" : "text";
  const [promptKind, setPromptKind] = useState<AnswerKind>(initialPromptKind);
  const switchedPrompt = promptKind !== initialPromptKind;
  // Neither side may be empty: an image prompt needs an image to be the prompt.
  const hasPromptImage = Boolean(promptImage.file || (initial?.image_url && !promptImage.remove));
  const initialAnswerKind = initial?.note_image_url ? "image" : "text";
  const [answerKind, setAnswerKind] = useState<AnswerKind>(initialAnswerKind);
  const switchedKind = answerKind !== initialAnswerKind;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (promptKind === "text" ? !trimmed : !hasPromptImage) return;
    const promptText = promptKind === "text" ? trimmed : switchedPrompt ? "" : (initial?.prompt ?? "");
    const promptImageChange =
      promptKind === "image" ? promptImage.change : switchedPrompt ? { remove: true } : undefined;
    // An answer is one thing or the other, so committing to a kind drops what
    // the other held — but only when the user actually switched: a legacy row
    // carrying both keeps them until someone chooses.
    const answerNotes = answerKind === "text" ? notes.trim() : switchedKind ? "" : (initial?.notes ?? "");
    const noteImageChange =
      answerKind === "image" ? noteImage.change : switchedKind ? { remove: true } : undefined;
    // Category keeps the typed case: autocomplete offers existing values
    // verbatim, and rewriting them would fork the category.
    onSubmit({
      draft: { prompt: promptText, notes: answerNotes, category: category.trim() },
      images: { image: promptImageChange, note_image: noteImageChange },
    });
  }

  return (
    <form className={initial ? formStyles.rowForm : formStyles.form} onSubmit={handleSubmit}>
      <fieldset className={formStyles.answer}>
        <legend className={formStyles.label}>Prompt</legend>
        <div className={formStyles.choices}>
          <AnswerKindChoice
            idPrefix={`${idPrefix}-prompt`}
            kind="text"
            label="Text"
            selected={promptKind}
            onSelect={setPromptKind}
          />
          <AnswerKindChoice
            idPrefix={`${idPrefix}-prompt`}
            kind="image"
            label="Image"
            selected={promptKind}
            onSelect={setPromptKind}
          />
        </div>
        {promptKind === "text" ? (
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor={`${idPrefix}-prompt-text`}>
              Prompt
            </label>
            <input
              id={`${idPrefix}-prompt-text`}
              className={formStyles.nameInput}
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
          </div>
        ) : (
          <ImageField
            id={`${idPrefix}-image`}
            label="Prompt image"
            field={promptImage}
            hasExisting={Boolean(initial?.image_url)}
          />
        )}
      </fieldset>
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
      <fieldset className={formStyles.answer}>
        <legend className={formStyles.label}>Answer</legend>
        <div className={formStyles.choices}>
          <AnswerKindChoice
            idPrefix={idPrefix}
            kind="text"
            label="Text note"
            selected={answerKind}
            onSelect={setAnswerKind}
          />
          <AnswerKindChoice
            idPrefix={idPrefix}
            kind="image"
            label="Image"
            selected={answerKind}
            onSelect={setAnswerKind}
          />
        </div>
        {answerKind === "text" ? (
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor={`${idPrefix}-notes`}>
              Notes
            </label>
            <textarea
              id={`${idPrefix}-notes`}
              className={formStyles.notesInput}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        ) : (
          <ImageField
            id={`${idPrefix}-note-image`}
            label="Note image"
            field={noteImage}
            hasExisting={Boolean(initial?.note_image_url)}
          />
        )}
      </fieldset>
      <div className={formStyles.buttons}>
        <button className={formStyles.saveButton} type="submit">
          Save
        </button>
        <button className={formStyles.cancelButton} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type AnswerKind = "text" | "image";

/** The answer is a text note or an image, never both — a radio, not two fields. */
function AnswerKindChoice({
  idPrefix,
  kind,
  label,
  selected,
  onSelect,
}: {
  idPrefix: string;
  kind: AnswerKind;
  label: string;
  selected: AnswerKind;
  onSelect: (kind: AnswerKind) => void;
}) {
  return (
    <label className={formStyles.choice}>
      <input
        type="radio"
        name={`${idPrefix}-answer-kind`}
        value={kind}
        checked={selected === kind}
        onChange={() => onSelect(kind)}
      />
      {label}
    </label>
  );
}

interface ImageFieldState {
  file: File | undefined;
  remove: boolean;
  setFile: (file: File | undefined) => void;
  setRemove: (remove: boolean) => void;
  /** Undefined when the slot is untouched, so the hooks skip that leg. */
  change: StudyImageChange | undefined;
}

/** One image slot's form state: a replacement file, or a request to clear it. */
function useImageField(): ImageFieldState {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [remove, setRemove] = useState(false);
  // A chosen file wins over the remove checkbox — it replaces the image anyway.
  const change = file ? { file } : remove ? { remove: true } : undefined;
  return { file, remove, setFile, setRemove, change };
}

function ImageField({
  id,
  label,
  field,
  hasExisting,
}: {
  id: string;
  label: string;
  field: ImageFieldState;
  hasExisting: boolean;
}) {
  return (
    <>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          className={formStyles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => field.setFile(event.target.files?.[0])}
        />
      </div>
      {hasExisting && !field.file && (
        <label className={formStyles.removeImage}>
          <input
            type="checkbox"
            checked={field.remove}
            onChange={(event) => field.setRemove(event.target.checked)}
          />
          Remove {label.toLowerCase()}
        </label>
      )}
    </>
  );
}
