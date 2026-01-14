import chalk from "chalk";
import Table from "cli-table3";

export function maskKey(key: string): string {
  if (key.length <= 8) {
    return "•".repeat(Math.max(4, key.length));
  }
  return `${key.slice(0, 4)}${"•".repeat(8)}${key.slice(-4)}`;
}

export function formatDate(value: string | number | Date | undefined): string {
  if (!value) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

export function renderTable(headers: string[], rows: Array<Array<string | number>>): string {
  const table = new Table({
    head: headers.map((header) => chalk.cyan(header)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  rows.forEach((row) => table.push(row.map((cell) => String(cell))));
  return table.toString();
}

export function highlight(label: string): string {
  return chalk.bold(chalk.magenta(label));
}

export function muted(value: string): string {
  return chalk.dim(value);
}
