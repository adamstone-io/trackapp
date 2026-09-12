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
  const description = taskTitle.trim();

  function handleClick() {
    addMoment.mutate({ description, timestamp: new Date().toISOString() });
    onAdded();
  }

  return (
    <button className={styles.button} type="button" disabled={!description} onClick={handleClick}>
      Add moment
    </button>
  );
}
