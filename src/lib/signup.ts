// What a sign-up may contain. The access form is public, so every value in it is
// untrusted: it is checked when it comes in (the API) and again where it is used
// (scripts/process-signups.ts), whatever the form or the database did before.

/**
 * A GitHub login: 1 to 39 characters, letters and digits, with single hyphens in
 * between. No hyphen at the start or the end and no two in a row. A sign-up names a
 * person's own account, so bot names ("name[bot]") are out on purpose.
 */
const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isGithubUsername(value: unknown): value is string {
  return typeof value === "string" && GITHUB_USERNAME.test(value);
}

/** What a person types ("@name", " name ") as the bare login. Not a check: use isGithubUsername on the result. */
export function cleanGithubUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^@/, "").trim() : "";
}

function hidden(code: number): boolean {
  return (
    code < 0x20 || // control characters, among them escape
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) || // zero width and direction marks
    (code >= 0x202a && code <= 0x202e) || // direction overrides
    (code >= 0x2066 && code <= 0x2069)
  );
}

/** A value from a form, safe to print in a terminal: no control or direction characters, and not endless. */
export function printable(value: unknown, max = 80): string {
  const text = Array.from(String(value ?? ""), (ch) => (hidden(ch.codePointAt(0) ?? 0) ? "?" : ch)).join("");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value) && printable(value, 254) === value;
}

export type SignupInput =
  | { ok: true; githubUsername: string; email: string }
  | { ok: false; error: string };

/** Reads the body of a sign-up request. Either field may be empty, not both. */
export function readSignup(body: unknown): SignupInput {
  const fields = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  let githubUsername = cleanGithubUsername(fields.githubUsername);
  let email = typeof fields.email === "string" ? fields.email.trim() : "";

  // People type their email address in the username field. Read it as the email address.
  if (!email && isEmail(githubUsername)) {
    email = githubUsername;
    githubUsername = "";
  }

  if (!githubUsername && !email) {
    return { ok: false, error: "Please provide a GitHub username or email address" };
  }
  if (githubUsername && !isGithubUsername(githubUsername)) {
    return {
      ok: false,
      error: "That is not a GitHub username. Use the name from your profile (github.com/your-name), or fill in your email address instead.",
    };
  }
  if (email && !isEmail(email)) {
    return { ok: false, error: "That is not an email address." };
  }
  return { ok: true, githubUsername, email };
}
