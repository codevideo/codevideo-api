import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export const getSumOfProcesses = async (commands: Array<string>) => {
  try {
    // this command is only correct for linux, you will need to adjust it for other operating systems
    const { stdout } = await execPromise("top -n 1 -b");

    const processes = stdout.split("\n").filter((line) => line.trim() !== "");
    let sum = 0;
    processes.forEach((process) => {
      const columns = process.split(/\s+/);
      const command = columns[11]; // Assuming command is at index 11, adjust accordingly

      if (commands.includes(command)) {
        const cpuUsage = parseFloat(columns[8]); // CPU usage, adjust index accordingly
        sum += cpuUsage;
      }
    });

    return sum;
  } catch (error) {
    throw error;
  }
};
