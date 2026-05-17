import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Identity passed inline so the site repo works without global git config.
const IDENTITY = [
  "-c", "user.name=chasm-codegen",
  "-c", "user.email=codegen@chasm.local",
];

function git(cwd: string, args: string[]): Promise<unknown> {
  return exec("git", args, { cwd });
}

/** Initialise the site dir as its own git repo with a first commit. */
export async function gitInit(cwd: string): Promise<void> {
  await git(cwd, ["init", "-q"]);
  await commitAll(cwd, "chore: initial site build");
}

/** Stage everything and commit. Returns false when there was nothing to commit. */
export async function commitAll(cwd: string, message: string): Promise<boolean> {
  await git(cwd, ["add", "-A"]);
  try {
    await git(cwd, [...IDENTITY, "commit", "-q", "-m", message]);
    return true;
  } catch {
    return false; // nothing staged — not an error
  }
}

/** Discard all uncommitted changes — used to undo an edit that broke the build. */
export async function revert(cwd: string): Promise<void> {
  await git(cwd, ["reset", "--hard", "-q", "HEAD"]);
  await git(cwd, ["clean", "-fdq"]);
}
