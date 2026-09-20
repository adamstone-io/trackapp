import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../api/types";
import type { ProjectCreate } from "../../api/projects";
import { formatDuration } from "../../lib/time";
import { useCreateProject, useDeleteProject, useEditProject, useProjectsQuery } from "./useProjects";
import { isSettled } from "../../lib/optimistic";
import { RowMenu } from "../../components/RowMenu";
import { PageMenu } from "../../components/PageMenu";
import { ProjectEntriesModal } from "./ProjectEntriesModal";
import styles from "./projects.module.css";
import formStyles from "./forms.module.css";

/** Preset palette; a swatch picker beats a raw hex field for a quick pick. */
export const PROJECT_COLORS = [
  { name: "Coral", value: "#e8613a" },
  { name: "Amber", value: "#d9a03f" },
  { name: "Green", value: "#4fa06a" },
  { name: "Teal", value: "#3f9fa0" },
  { name: "Blue", value: "#4f7fd9" },
  { name: "Violet", value: "#8b6fd9" },
  { name: "Magenta", value: "#c95f9f" },
  { name: "Slate", value: "#8a94a6" },
];

export function ProjectSection() {
  const { data: projects } = useProjectsQuery();
  const navigate = useNavigate();

  if (!projects) return null;
  const active = projects.filter((project) => !project.archived);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="projects-heading" className={styles.heading}>
            Projects
          </h2>
          <PageMenu
            items={[{ label: "Archived", onSelect: () => navigate("/workspace/archived") }]}
          />
        </div>
        {active.length === 0 ? (
          <p className={styles.empty}>Create your first project.</p>
        ) : (
          <ul className={styles.list} aria-labelledby="projects-heading">
            {active.map((project) => (
              <li key={project.id} className={styles.item}>
                <ProjectRow project={project} />
              </li>
            ))}
          </ul>
        )}
        <AddProjectForm />
      </section>
    </>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [showingEntries, setShowingEntries] = useState(false);
  const editMutation = useEditProject();
  const deleteMutation = useDeleteProject();

  if (editing) {
    return (
      <ProjectForm
        idPrefix={`edit-project-${project.id}`}
        initial={project}
        onSubmit={(draft) => {
          editMutation.mutate({ id: project.id, patch: draft });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <div className={styles.main}>
        <ColorDot color={project.color} />
        <span className={styles.name}>{project.name}</span>
        {project.description && <span className={styles.description}>{project.description}</span>}
      </div>
      <span className={styles.time}>{formatDuration(project.total_seconds)}</span>
      <RowMenu
        name={project.name}
        disabled={!isSettled(project.id)}
        items={[
          { label: "Time entries", onSelect: () => setShowingEntries(true) },
          { label: "Edit", onSelect: () => setEditing(true) },
          {
            label: "Archive",
            onSelect: () => editMutation.mutate({ id: project.id, patch: { archived: true } }),
          },
          {
            label: "Delete",
            danger: true,
            confirm: "Confirm delete",
            confirmNote: "Tasks keep their history and become unassigned.",
            onSelect: () => deleteMutation.mutate(project.id),
          },
        ]}
      />
      {showingEntries && (
        <ProjectEntriesModal project={project} onClose={() => setShowingEntries(false)} />
      )}
    </>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className={styles.dot} style={{ background: color }} data-color={color} aria-hidden="true" />;
}

function AddProjectForm() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateProject();

  if (!open) {
    return (
      <button className={formStyles.openButton} type="button" onClick={() => setOpen(true)}>
        Add project
      </button>
    );
  }

  return (
    <ProjectForm
      idPrefix="add-project"
      onSubmit={(draft) => {
        createMutation.mutate(draft);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

/** Name/description/color form shared by add (no initial) and edit. */
function ProjectForm({
  idPrefix,
  initial,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial?: Project;
  onSubmit: (draft: ProjectCreate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0].value);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, description: description.trim(), color });
  }

  return (
    <form className={initial ? formStyles.rowForm : formStyles.form} onSubmit={handleSubmit}>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          className={formStyles.nameInput}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          required
        />
      </div>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <input
          id={`${idPrefix}-description`}
          className={formStyles.nameInput}
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={formStyles.field}>
        <span className={formStyles.label} id={`${idPrefix}-color-label`}>
          Color
        </span>
        <div
          className={formStyles.swatches}
          role="radiogroup"
          aria-labelledby={`${idPrefix}-color-label`}
        >
          {PROJECT_COLORS.map((swatch) => (
            <input
              key={swatch.value}
              className={formStyles.swatch}
              type="radio"
              name={`${idPrefix}-color`}
              aria-label={swatch.name}
              checked={color === swatch.value}
              onChange={() => setColor(swatch.value)}
              style={{ background: swatch.value }}
            />
          ))}
        </div>
      </div>
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
