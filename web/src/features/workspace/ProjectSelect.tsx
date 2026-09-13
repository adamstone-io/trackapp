import { useProjectsQuery } from "./useWorkspace";

/** Project picker shared by the timer, the manual entry form and the day log.
 * Archived projects are left out: they aren't somewhere to log new time. */
export function ProjectSelect({
  id,
  value,
  onChange,
  className,
  ariaLabel,
  autoFocus,
}: {
  id?: string;
  value: string | null;
  onChange: (projectId: string | null) => void;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const { data: projects } = useProjectsQuery();
  const active = (projects ?? []).filter((project) => !project.archived);

  return (
    <select
      id={id}
      className={className}
      aria-label={ariaLabel}
      value={value ?? ""}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">No project</option>
      {active.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}
