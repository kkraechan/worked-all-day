const form = document.getElementById("timeForm");
const tasksContainer = document.getElementById("tasksContainer");
const taskTemplate = document.getElementById("taskTemplate");
const addTaskBtn = document.getElementById("addTaskBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const entriesList = document.getElementById("entriesList");
const presetTasksContainer = document.getElementById("presetTasks");
const breaksContainer = document.getElementById("breaksContainer");
const breakTemplate = document.getElementById("breakTemplate");
const addBreakBtn = document.getElementById("addBreakBtn");

const dateInput = document.getElementById("date");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");

const grossTimeEl = document.getElementById("grossTime");
const breakTimeEl = document.getElementById("breakTime");
const breakTimeNoteEl = document.getElementById("breakTimeNote");
const taskTimeEl = document.getElementById("taskTime");
const openTimeEl = document.getElementById("openTime");
const summaryWarningEl = document.getElementById("summaryWarning");

const presetTasks = [
    {name: "Daily", duration: "0:15"},
    {name: "Review", duration: "1:00"},
    {name: "Planning", duration: "1:45"},
    {name: "Retro", duration: "1:20"},
    {name: "Refinement", duration: "1:00"},
    {name: "DevTalk", duration: "1:00"}
];

let entries = JSON.parse(localStorage.getItem("worklogEntries") || "[]");

function addBreakRow(breakEntry = {startTime: "", endTime: ""}) {
    const clone = breakTemplate.content.cloneNode(true);
    const row = clone.querySelector(".break-row");
    const startInput = clone.querySelector(".break-start-time");
    const endInput = clone.querySelector(".break-end-time");
    const removeBtn = clone.querySelector(".remove-break");

    startInput.value = breakEntry.startTime || "";
    endInput.value = breakEntry.endTime || "";

    startInput.addEventListener("input", updateSummary);
    endInput.addEventListener("input", updateSummary);
    removeBtn.addEventListener("click", () => {
        row.remove();
        updateSummary();
    });

    breaksContainer.appendChild(clone);
    updateSummary();
}

function addTaskRow(task = {name: "", duration: "", completed: false}) {
    const clone = taskTemplate.content.cloneNode(true);
    const row = clone.querySelector(".task-row");
    const nameInput = clone.querySelector(".task-name");
    const durationInput = clone.querySelector(".task-duration");
    const removeBtn = clone.querySelector(".remove-task");

    nameInput.value = task.name || "";
    durationInput.value = task.duration || "";
    row.dataset.completed = String(Boolean(task.completed));

    durationInput.addEventListener("input", updateSummary);
    removeBtn.addEventListener("click", () => {
        row.remove();
        updateSummary();
    });

    tasksContainer.appendChild(clone);
    updateSummary();
}

function renderPresetTasks() {
    presetTasksContainer.innerHTML = presetTasks
        .map((task, index) => `
            <button type="button" class="preset-task-chip" data-preset-index="${index}">
                <span>${task.name}</span>
            </button>
        `)
        .join("");

    presetTasksContainer.querySelectorAll(".preset-task-chip").forEach((button) => {
        button.addEventListener("click", () => {
            const presetTask = presetTasks[Number(button.dataset.presetIndex)];
            addTaskRow({
                ...presetTask,
                completed: false
            });
        });
    });
}

function timeToMinutes(value) {
    if (!value || !value.includes(":")) return 0;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const safeMinutes = Math.max(0, minutes || 0);
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hrs}:${String(mins).padStart(2, "0")}`;
}

function formatDate(dateString) {
    if (!dateString || !dateString.includes("-")) return dateString;

    const date = new Date(`${dateString}T00:00:00`);
    const weekday = date.toLocaleDateString("de-DE", {weekday: "short"}).replace(".", "");
    const [year, month, day] = dateString.split("-");

    return `${weekday}, ${day}.${month}.${year}`;
}

function isValidHourMinute(value) {
    return /^(\d{1,2}):([0-5]\d)$/.test(value);
}

function durationToMinutes(value) {
    if (!isValidHourMinute(value)) return 0;
    return timeToMinutes(value);
}

function calculateGrossMinutes() {
    const start = timeToMinutes(startTimeInput.value);
    const end = timeToMinutes(endTimeInput.value);
    if (end <= start) return 0;
    return end - start;
}

function getMinimumRequiredBreakMinutes(grossMinutes, enteredBreakMinutes = 0) {
    const legalBreakSteps = [0, 30, 45];

    for (const requiredBreakMinutes of legalBreakSteps) {
        const effectiveBreakMinutes = Math.max(enteredBreakMinutes, requiredBreakMinutes);
        const netWorkMinutes = grossMinutes - effectiveBreakMinutes;
        const requiredForNetWorkMinutes = netWorkMinutes > 9 * 60
            ? 45
            : netWorkMinutes > 6 * 60
                ? 30
                : 0;

        if (requiredBreakMinutes >= requiredForNetWorkMinutes) {
            return requiredBreakMinutes;
        }
    }

    return 45;
}

function getBreakRows() {
    return [...document.querySelectorAll(".break-row")];
}

function getCurrentBreaks() {
    return getBreakRows()
        .map((row) => ({
            startTime: row.querySelector(".break-start-time").value,
            endTime: row.querySelector(".break-end-time").value
        }))
        .filter((breakEntry) => breakEntry.startTime || breakEntry.endTime);
}

function calculateBreakMinutesFromBreaks(breaks) {
    return breaks.reduce((sum, breakEntry) => {
        const start = timeToMinutes(breakEntry.startTime);
        const end = timeToMinutes(breakEntry.endTime);
        if (end <= start) return sum;
        return sum + (end - start);
    }, 0);
}

function calculateTaskMinutes() {
    const durations = [...document.querySelectorAll(".task-duration")];
    return durations.reduce((sum, input) => sum + durationToMinutes(input.value), 0);
}

function calculateEffectiveBreakMinutes(grossMinutes, enteredBreakMinutes) {
    return Math.max(enteredBreakMinutes, getMinimumRequiredBreakMinutes(grossMinutes, enteredBreakMinutes));
}

function calculateExceededMinutes(grossMinutes, effectiveBreakMinutes, taskMinutes) {
    return Math.max(effectiveBreakMinutes + taskMinutes - grossMinutes, 0);
}

function calculateOpenMinutes() {
    const gross = calculateGrossMinutes();
    const enteredBreakMinutes = calculateBreakMinutesFromBreaks(getCurrentBreaks());
    const effectiveBreakMinutes = calculateEffectiveBreakMinutes(gross, enteredBreakMinutes);
    const taskTotal = calculateTaskMinutes();
    return Math.max(gross - effectiveBreakMinutes - taskTotal, 0);
}

function updateSummary() {
    const gross = calculateGrossMinutes();
    const enteredBreakMinutes = calculateBreakMinutesFromBreaks(getCurrentBreaks());
    const effectiveBreakMinutes = calculateEffectiveBreakMinutes(gross, enteredBreakMinutes);
    const taskTotal = calculateTaskMinutes();
    const openMinutes = Math.max(gross - effectiveBreakMinutes - taskTotal, 0);
    const exceededMinutes = calculateExceededMinutes(gross, effectiveBreakMinutes, taskTotal);

    grossTimeEl.textContent = minutesToTime(gross);
    breakTimeEl.textContent = minutesToTime(effectiveBreakMinutes);
    taskTimeEl.textContent = minutesToTime(taskTotal);
    openTimeEl.textContent = minutesToTime(openMinutes);

    if (effectiveBreakMinutes !== enteredBreakMinutes) {
        breakTimeNoteEl.textContent = `(manuell: ${minutesToTime(enteredBreakMinutes)})`;
    } else {
        breakTimeNoteEl.textContent = "";
    }

    summaryWarningEl.textContent = exceededMinutes > 0
        ? `Warnung: Erfasste Zeiten überschreiten die Gesamtzeit um ${minutesToTime(exceededMinutes)}.`
        : "";
}

function saveToLocalStorage() {
    localStorage.setItem("worklogEntries", JSON.stringify(entries));
}

function normalizeBreaks(entry) {
    if (Array.isArray(entry.breaks)) {
        return entry.breaks.map((breakEntry) => ({
            startTime: breakEntry.startTime || "",
            endTime: breakEntry.endTime || ""
        }));
    }

    if (entry.breakStartTime || entry.breakEndTime) {
        return [{
            startTime: entry.breakStartTime || "",
            endTime: entry.breakEndTime || ""
        }];
    }

    return [];
}

function normalizeEntries(importedEntries) {
    return importedEntries.map((entry) => ({
        ...entry,
        breaks: normalizeBreaks(entry),
        tasks: Array.isArray(entry.tasks)
            ? entry.tasks.map((task) => ({
                name: task.name || "",
                duration: task.duration || "",
                completed: Boolean(task.completed)
            }))
            : []
    }));
}

function validateBreaks(breaks, workStartMinutes, workEndMinutes, grossMinutes) {
    for (const breakEntry of breaks) {
        if (!breakEntry.startTime || !breakEntry.endTime) {
            return "Bitte für jede Pause sowohl Start- als auch Endzeit angeben.";
        }

        const breakStartMinutes = timeToMinutes(breakEntry.startTime);
        const breakEndMinutes = timeToMinutes(breakEntry.endTime);

        if (breakEndMinutes <= breakStartMinutes) {
            return "Pausen dürfen nicht über Mitternacht laufen und die Endzeit muss nach der Startzeit liegen.";
        }

        if (breakStartMinutes < workStartMinutes || breakEndMinutes > workEndMinutes) {
            return "Pausen müssen vollständig innerhalb der Arbeitszeit liegen.";
        }
    }

    const sortedBreaks = [...breaks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (let i = 1; i < sortedBreaks.length; i += 1) {
        const previousBreakEnd = timeToMinutes(sortedBreaks[i - 1].endTime);
        const currentBreakStart = timeToMinutes(sortedBreaks[i].startTime);
        if (currentBreakStart < previousBreakEnd) {
            return "Pausen dürfen sich nicht überschneiden.";
        }
    }

    const enteredBreakMinutes = calculateBreakMinutesFromBreaks(breaks);
    if (enteredBreakMinutes > grossMinutes) {
        return "Die gesamte Pausendauer darf nicht länger als die Gesamtzeit sein.";
    }

    return "";
}

function toggleTaskCompleted(entryIndex, taskIndex) {
    if (!entries[entryIndex] || !entries[entryIndex].tasks[taskIndex]) return;

    entries[entryIndex].tasks[taskIndex].completed = !entries[entryIndex].tasks[taskIndex].completed;
    saveToLocalStorage();
    renderEntries();
}

function getBreakDisplay(entry) {
    const breaks = Array.isArray(entry.breaks) ? entry.breaks : normalizeBreaks(entry);
    const enteredBreakMinutes = calculateBreakMinutesFromBreaks(breaks);
    const grossMinutes = Math.max(timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime), 0);
    const effectiveBreakMinutes = calculateEffectiveBreakMinutes(grossMinutes, enteredBreakMinutes);

    if (!breaks.length) {
        return effectiveBreakMinutes > 0
            ? `Automatisch: ${minutesToTime(effectiveBreakMinutes)}, manuell: 0:00`
            : "Nicht erfasst";
    }

    const breakRanges = breaks
        .map((breakEntry) => `${breakEntry.startTime} - ${breakEntry.endTime}`)
        .join(", ");

    if (effectiveBreakMinutes !== enteredBreakMinutes) {
        return `${breakRanges} (manuell: ${minutesToTime(enteredBreakMinutes)}, berücksichtigt: ${minutesToTime(effectiveBreakMinutes)})`;
    }

    return `${breakRanges} (${minutesToTime(effectiveBreakMinutes)})`;
}

function renderEntries() {
    if (entries.length === 0) {
        entriesList.innerHTML = `<div class="empty-state">Noch keine Einträge vorhanden.</div>`;
        return;
    }

    entriesList.innerHTML = entries
        .slice()
        .reverse()
        .map((entry, reversedEntryIndex, reversedEntries) => {
            const entryIndex = reversedEntries.length - 1 - reversedEntryIndex;
            const gross = Math.max(timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime), 0);

            const tasksHtml = entry.tasks.length
                ? `<ul class="entry-tasks">
            ${entry.tasks
                    .map((task, taskIndex) => `
                    <li class="entry-task-item">
                        <input
                            type="checkbox"
                            ${task.completed ? "checked" : ""}
                            data-entry-index="${entryIndex}"
                            data-task-index="${taskIndex}"
                            class="task-completed-checkbox"
                        >
                        <span>${task.name} - ${task.duration}</span>
                    </li>
                `)
                    .join("")}
          </ul>`
                : `<p class="entry-tasks">Keine Tasks erfasst</p>`;

            return `
        <div class="entry-card">
          <div class="entry-top">
            <div>
              <strong>${formatDate(entry.date)}</strong><br>
              ${entry.startTime} - ${entry.endTime}
            </div>
            <div>
              Pause: ${getBreakDisplay(entry)}<br>
              Gesamtzeit: ${minutesToTime(gross)}
            </div>
          </div>
          ${tasksHtml}
        </div>
      `;
        })
        .join("");

    document.querySelectorAll(".task-completed-checkbox").forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
            const entryIndex = Number(event.target.dataset.entryIndex);
            const taskIndex = Number(event.target.dataset.taskIndex);
            toggleTaskCompleted(entryIndex, taskIndex);
        });
    });
}

function resetForm() {
    form.reset();
    breaksContainer.innerHTML = "";
    tasksContainer.innerHTML = "";
    addTaskRow();
    updateSummary();
}

addBreakBtn.addEventListener("click", () => addBreakRow());
addTaskBtn.addEventListener("click", () => addTaskRow());

[startTimeInput, endTimeInput].forEach(input => {
    input.addEventListener("input", updateSummary);
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const taskRows = [...document.querySelectorAll(".task-row")];
    const tasks = taskRows
        .map(row => ({
            name: row.querySelector(".task-name").value.trim(),
            duration: row.querySelector(".task-duration").value.trim(),
            completed: row.dataset.completed === "true"
        }))
        .filter(task => task.name && isValidHourMinute(task.duration) && durationToMinutes(task.duration) > 0);

    const gross = calculateGrossMinutes();
    const breaks = getCurrentBreaks();
    const workStartMinutes = timeToMinutes(startTimeInput.value);
    const workEndMinutes = timeToMinutes(endTimeInput.value);

    if (gross <= 0) {
        alert("Die Enduhrzeit muss nach der Startuhrzeit liegen.");
        return;
    }

    const breakValidationError = validateBreaks(breaks, workStartMinutes, workEndMinutes, gross);
    if (breakValidationError) {
        alert(breakValidationError);
        return;
    }

    const invalidTask = taskRows.some(row => {
        const name = row.querySelector(".task-name").value.trim();
        const duration = row.querySelector(".task-duration").value.trim();
        return (name || duration) && (!name || !isValidHourMinute(duration) || durationToMinutes(duration) <= 0);
    });

    if (invalidTask) {
        alert("Bitte alle Task-Dauern im Format hh:mm angeben.");
        return;
    }

    const enteredBreakMinutes = calculateBreakMinutesFromBreaks(breaks);
    const effectiveBreakMinutes = calculateEffectiveBreakMinutes(gross, enteredBreakMinutes);
    const taskTotal = tasks.reduce((sum, task) => sum + durationToMinutes(task.duration), 0);
    const exceededMinutes = calculateExceededMinutes(gross, effectiveBreakMinutes, taskTotal);

    if (exceededMinutes > 0) {
        alert(`Speichern nicht möglich: Erfasste Zeiten überschreiten die Gesamtzeit um ${minutesToTime(exceededMinutes)}.`);
        return;
    }

    const entry = {
        date: dateInput.value,
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
        breaks,
        tasks
    };

    entries.push(entry);
    saveToLocalStorage();
    renderEntries();
    resetForm();
});

resetBtn.addEventListener("click", resetForm);

exportBtn.addEventListener("click", () => {
    const data = {entries};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "arbeitszeiten.json";
    a.click();

    URL.revokeObjectURL(url);
});

importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            entries = normalizeEntries(imported.entries || []);
            saveToLocalStorage();
            renderEntries();
            resetForm();
        } catch {
            alert("Ungültige JSON-Datei.");
        }
    };
    reader.readAsText(file);
});

entries = normalizeEntries(entries);

renderPresetTasks();
addTaskRow();
renderEntries();
updateSummary();
