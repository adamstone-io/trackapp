// controllers/moment-controller.js
import { Moment } from "../domain/moment.js";
import { MomentView } from "../views/moment-view.js";
import * as currentTask from "../state/current-task.js";
import { byId } from "../ui/ui-core.js";
import { momentIds } from "../ui/moment-ids.js";
import { saveMoments, loadMoments, updateMoment } from "../data/storage.js";

let moments = [];

export function createMomentController({ onMomentsChanged, onMomentAdded } = {}) {
    moments = loadMoments();
    let editingMomentId = null;
    let editingMomentBase = null;

    const logMomentBtn = byId(momentIds.logMomentBtn);

    const handleOpen = () => {
        editingMomentId = null;
        editingMomentBase = null;
        MomentView.openForCreate();
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

        if (editingMomentId) {
            const patch = {
                description: data.description,
                category: data.category,
            };

            const updatedTimestampMs = toTimestampWithTime(
                editingMomentBase,
                data.time
            );
            if (Number.isFinite(updatedTimestampMs)) {
                patch.timestampMs = updatedTimestampMs;
            }

            const updated = updateMoment(editingMomentId, patch);

            if (updated) {
                moments = loadMoments();
                if (typeof onMomentsChanged === "function") {
                    onMomentsChanged();
                } else if (typeof onMomentAdded === "function") {
                    onMomentAdded();
                }
            }

            editingMomentId = null;
            editingMomentBase = null;
            MomentView.close();
            return;
        }

        const taskSnapshot = currentTask.getSnapshot();
        const createdTimestampMs = toTimestampWithTime(null, data.time);

        const moment = new Moment({
            description: data.description,
            category: data.category,
            isMilestone: data.isMilestone,
            taskId: taskSnapshot.task?.id || null,
            taskTitle: taskSnapshot.task?.title || null,
            timestampMs: Number.isFinite(createdTimestampMs)
                ? createdTimestampMs
                : undefined,
        });

        const next = loadMoments();
        next.push(moment);
        saveMoments(next);
        moments = next;

        if (typeof onMomentsChanged === "function") {
            onMomentsChanged(moment);
        } else if (typeof onMomentAdded === "function") {
            onMomentAdded(moment);
        }

        MomentView.close();
    }

    function handleCancel() {
        editingMomentId = null;
        editingMomentBase = null;
        MomentView.close();
    }

    return {
        getMoments: () => [...moments],
        openEdit: (moment) => {
            if (!moment?.id) return;
            editingMomentId = moment.id;
            editingMomentBase = moment;
            MomentView.openForEdit(moment);
        },
        dispose: () => {
            unbindModal();
            logMomentBtn.removeEventListener("click", handleOpen);
        },
    };
}

function toTimestampWithTime(baseMoment, timeValue) {
    if (!timeValue) return null;
    const match = /^(\d{2}):(\d{2})$/.exec(timeValue);
    if (!match) return null;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    const baseMs =
        Number.isFinite(baseMoment?.timestampMs)
            ? baseMoment.timestampMs
            : baseMoment?.createdAt
              ? new Date(baseMoment.createdAt).getTime()
              : Date.now();
    const date = new Date(baseMs);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
}
