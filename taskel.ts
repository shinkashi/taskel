import { toPathString } from "https://deno.land/std@0.195.0/fs/_util.ts";
import { walkSync } from "https://deno.land/std@0.195.0/fs/mod.ts";
import dayjs, { Dayjs } from "npm:dayjs@1.11.7";

const vaultPath = Deno.env.get("HOME") + "/Work";
// "/Library/Mobile Documents/iCloud~com~logseq~logseq/Documents/Main"

//const projects: {string: dayjs} = {};

class Task {
    file: string = "";
    name: string = "";
    remain: number = 2;
    scheduleTime: Dayjs | undefined;
    startTime: Dayjs | undefined;
    endTime: Dayjs | undefined;

    constructor(obj: Partial<Task>) {
        Object.assign(this, obj);
    }

    get note(): string {
        return this.file.replace(/\.md$/, "");
    }

    get scheduleTimeOrNow(): Dayjs {
        if (this.scheduleTime && this.scheduleTime.isAfter(dayjs())) {
            return this.scheduleTime;
        }
        return dayjs();
    }

    complete(time: Dayjs) {
        const hours = 1;
        this.startTime = time;
        this.endTime = time.add(hours, "hour");
    }
}

class TaskRepo {
    tasks: Task[] = [];

    constructor() {}

    add(task: Task) {
        this.tasks.push(task);
    }

    delete(task: Task) {
        this.tasks = this.tasks.filter((t) => t !== task);
    }

    collectFromMarkdown() {
        const walkSyncOpt = {
            includeDirs: false,
            exts: [".md"],
            skip: [/logseq/],
        };

        for (const file of walkSync(vaultPath, walkSyncOpt)) {
            // create tasks
            for (const line of Deno.readTextFileSync(file.path).split(/\n/)) {
                const match = line.match(/\- \[ \] (.*)$/);
                if (!match) continue;
                const [, name] = match;
                const [, scheduled] = line.match(/[⏳🛫]\s*([-\d]+)/) || [];
                const [, remain] = line.match(/⏲️\s*(\d+)/) || [];

                const task = new Task({
                    file: file.name,
                    name: name,
                    scheduleTime: scheduled ? dayjs(scheduled) : undefined,
                    remain: remain ? parseInt(remain) : 1,
                });

                this.add(task);
            }
        }
    }

    execute() {
        let clock = dayjs();

        let task;

        while ((task = this.getTopTask())) {
            console.log({
                clock: clock.format("DD/MMM ddd HH:mm"),
                taskName: task.name,
                taskRemain: task.remain,
                taskStartTime: task.startTime?.format("DD/MMM ddd HH:mm"),
                taskEndTime: task.endTime?.format("DD/MMM ddd HH:mm"),
            });

            task.complete(clock);

            // create next task
            const hours = 1;
            const remain = task.remain - hours;
            clock = proceedClock(clock, hours);

            if (remain > 0) {
                const nextTask = new Task({
                    name: task.name,
                    file: task.file,
                    remain,
                    scheduleTime: clock,
                    startTime: undefined,
                    endTime: undefined,
                });
                this.add(nextTask);
            }
        }
    }

    getReport(): string {
        let report = "";
        report += "|scheduled|start|note|description|remain|\n";
        report += "|---|---|---|---|---|\n";

        const tasks = this.tasks.toSorted((a, b) =>
            a.startTime?.isBefore(b.startTime) ? -1 : 1
        );

        for (const task of tasks) {
            const scheduledTime =
                task.scheduleTime?.format("DD/MMM ddd HH:mm") || "";
            const note = task.note.replaceAll(/\|/g, "");
            const startTime = task.startTime?.format("DD/MMM HH:mm") || "";
            const endTime = task.endTime?.format("DD/MMM HH:mm") || "";

            const line =
                `|${scheduledTime}|${startTime}|[[${note}]]|${task.name}|${task.remain}|\n`;
            report += line;
        }

        return report;
    }

    getTopTask(): Task | undefined {
        const remainingTasks = this.tasks.filter((t) => !t.startTime);
        if (remainingTasks.length === 0) return undefined;
        let topTask: Task = remainingTasks[0];
        for (const task of remainingTasks) {
            if (task.scheduleTimeOrNow.isBefore(task.scheduleTimeOrNow)) {
                topTask = task;
            }
        }
        return topTask;
    }
}

function proceedClock(t: Dayjs, hours: number): Dayjs {
    t = t.add(hours, "hour");
    if (t.hour() < 9 || t.hour() >= 17) {
        t = t.hour(9);
        t = t.add(1, "day");
    }
    return t;
}

// main
function main() {
    const taskRepo = new TaskRepo();

    taskRepo.collectFromMarkdown();

    taskRepo.execute();

    const report = taskRepo.getReport();

    // display report
    console.clear();
    console.log(report);

    // write report to file
    Deno.writeTextFileSync(vaultPath + "/pages/taskette.md", report);
}

main();
