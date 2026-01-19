// controllers/moment-controller.js
import { Moment } from "../domain/moment.js";
import { MomentView } from "../views/moment-view.js";
import * as currentTask from "../state/current-task.js";
import { byId } from "../ui/ui-core.js";
import { momentIds } from "../ui/moment-ids.js";
import { saveMoments, loadMoments } from "../data/storage.js";

let moments = [];

export function createMomentController({ onMomentAdded } = {}) {
    moments = loadMoments();

    const logMomentBtn = byId(momentIds.logMomentBtn);

    const handleOpen = () => {
        MomentView.open();
    };

    logMomentBtn.addEventListener("click", handleOpen);

    const unbindModal = MomentView.bind({
        onSave: handleSave,
        onCancel: handleCancel,
    });

    function handleSave() {
        const data = MomentView.readMoment();

        if (!data.description) {
            alert("Please describe this moment");
            return;
        }

        const taskSnapshot = currentTask.getSnapshot();

        const moment = new Moment({
            description: data.description,
            category: data.category,
            isMilestone: data.isMilestone,
            taskId: taskSnapshot.task?.id || null,
            taskTitle: taskSnapshot.task?.title || null,
        });

        const next = loadMoments();
        next.push(moment);
        saveMoments(next);
        moments = next;

        if (typeof onMomentAdded === "function") {
            onMomentAdded(moment);
        }

        MomentView.close();
    }

    function handleCancel() {
        MomentView.close();
    }

    return {
        getMoments: () => [...moments],
        dispose: () => {
            unbindModal();
            logMomentBtn.removeEventListener("click", handleOpen);
        },
    };
}
