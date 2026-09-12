import { useAddMoment } from "./useTimeEntries";
import styles from "./AddMomentButton.module.css";

interface AddMomentButtonProps {
  /** Text from the timer's task title field; it becomes the moment description. */
  taskTitle: string;
  /** Called after the moment is created so the page can clear the title field. */
  onAdded: () => void;
}

export function AddMomentButton({ taskTitle, onAdded }: AddMomentButtonProps) {
  const addMoment = useAddMoment();

  function handleClick() {
    // On the go there's often no time to type — log the time now as
    // "Untitled" and rename it from the log later.
    addMoment.mutate({
      description: taskTitle.trim() || "Untitled",
      timestamp: new Date().toISOString(),
    });
    onAdded();
  }

  return (
    <button className={styles.button} type="button" onClick={handleClick}>
      Add moment
    </button>
  );
}
