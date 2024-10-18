import { walkSync } from "https://deno.land/std@0.195.0/fs/mod.ts";
import { sprintf } from "https://deno.land/std@0.195.0/fmt/printf.ts";
import dayjs, { Dayjs } from "npm:dayjs@1.11.7";

const vaultPath = (
    Deno.env.get('HOME') +
    "/Work"
    // "/Library/Mobile Documents/iCloud~com~logseq~logseq/Documents/Main"
);

//const projects: {string: dayjs} = {};

class Task {
    name: string;
    startTime: Dayjs;

    constructor(name: string, startTime: Dayjs) {
        this.name = name;
        this.startTime = startTime.clone();
    }

    static parse(line: string, startTime: Dayjs): Task | null {
        // const result = line.match(/\- (TODO|DOING) (.*)$/);
        const result = line.match(/^- \[ \] (.*)$/);
        if (!result) return null;
        return new Task(result[1], startTime)
    }

    print() {
        return sprintf(
            "%s %s \n",
            this.startTime.format("MM/DD ddd HH:mm"),
            this.name,
        )
    }
}

function getNextStarTime(t: Dayjs) {
    t = t.add(1, 'hour')
    if (t.hour() < 18 || t.hour() >= 22) {
        t = t.hour(18);
        t = t.add(1, 'day')
    }
    return t;
}

// main
function main() {
    const tasks: Task[] = [];

    const walkSyncOpt = {
        includeDirs: false,
        exts: ['.md'],
        skip: [
            /2022.+\dZ\.md$/,
            /Main\/logseq/
        ]
    };

    let startTime = dayjs();

    for (const file of walkSync(vaultPath, walkSyncOpt)) {

        // create tasks
        for (const line of Deno.readTextFileSync(file.path).split(/\n/)) {
            const task = Task.parse(line, startTime.clone());
            if (!task) continue;
            tasks.push(task);
            startTime = getNextStarTime(startTime);
        }
    }

    // sort by interval in ascending order
    // tasks.sort((a, b) => a.interval - b.interval)

    // create report
    let report = "";
    for (const task of tasks) {
        report += task.print();
    }

    console.clear();
    console.log(report);
    Deno.writeTextFileSync(vaultPath + "/pages/taskette.md", report)
}

main()

