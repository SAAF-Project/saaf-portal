import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The script talks to a database, a terminal and the gh command. All three are replaced here,
// so the test shows what the script would run without running anything.
const fake = vi.hoisted(() => ({
  pending: [] as { id: string; githubUsername: string; email: string | null; createdAt: Date }[],
  // The person at the terminal: what they answer when asked to correct a name, and when asked what to do.
  correction: "s",
  action: "s",
  questions: [] as string[],
  ghId: "583231\n",
  gh: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));

vi.mock("dotenv", () => ({ config: () => ({}) }));
vi.mock("pg", () => ({
  Client: class {
    connect = async () => {};
    query = fake.query;
    end = fake.end;
  },
}));
vi.mock("readline", () => ({
  createInterface: () => ({
    question: (question: string, answer: (text: string) => void) => {
      fake.questions.push(question);
      answer(question.includes("Action") ? fake.action : fake.correction);
    },
    close: () => {},
  }),
}));
vi.mock("child_process", () => ({ execFileSync: fake.gh }));

const row = (githubUsername: string, email: string | null = null) => ({
  id: "request-1",
  githubUsername,
  email,
  createdAt: new Date("2026-11-18T09:00:00Z"),
});

async function run() {
  vi.resetModules();
  await import("./process-signups");
  await vi.waitFor(() => expect(fake.end).toHaveBeenCalled());
}

const ghCalls = () => fake.gh.mock.calls.map(([command, args]) => [command, ...(args as string[])].join(" "));
const updates = () => fake.query.mock.calls.filter(([sql]) => String(sql).startsWith("UPDATE")).map(([sql]) => String(sql));

describe("process-signups", () => {
  beforeEach(() => {
    fake.correction = "s";
    fake.action = "s";
    fake.questions = [];
    fake.ghId = "583231\n";
    fake.gh.mockReset().mockImplementation((_command: string, args: string[]) => (args[1].startsWith("/users/") ? fake.ghId : ""));
    fake.query.mockReset().mockImplementation(async (sql: string) => (sql.startsWith("SELECT") ? { rows: fake.pending } : { rows: [] }));
    fake.end.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("invites an approved username, with gh called as a list of arguments", async () => {
    fake.pending = [row("octocat")];
    fake.action = "a";
    await run();

    expect(fake.gh.mock.calls.map(([command, args]) => [command, args])).toEqual([
      ["gh", ["api", "/users/octocat", "--jq", ".id"]],
      ["gh", ["api", "/orgs/SAAF-Project/invitations", "-F", "invitee_id=583231", "-f", "role=direct_member"]],
    ]);
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).toContain("'approved'");
  });

  it("never passes on a username that GitHub would not accept, even when the person approves everything", async () => {
    for (const hostile of ["$(id)", "`id`", "x;id", "x|id", "../orgs/SAAF-Project", "name with space", "name@example.com"]) {
      fake.pending = [row(hostile)];
      fake.action = "a";
      fake.questions = [];
      fake.gh.mockClear();
      fake.query.mockClear();
      fake.end.mockClear();
      await run();

      expect(fake.questions, hostile).toHaveLength(1);
      expect(fake.questions[0], hostile).toContain("is not a valid GitHub username");
      expect(ghCalls(), hostile).toEqual([]);
      expect(updates(), hostile).toEqual([]);
    }
  });

  it("asks for the right name, and checks that one too", async () => {
    fake.pending = [row("$(id)")];
    fake.correction = "`id`";
    fake.action = "a";
    await run();
    expect(ghCalls()).toEqual([]);

    fake.gh.mockClear();
    fake.end.mockClear();
    fake.correction = "@octocat";
    await run();
    expect(ghCalls()).toEqual([
      "gh api /users/octocat --jq .id",
      "gh api /orgs/SAAF-Project/invitations -F invitee_id=583231 -f role=direct_member",
    ]);
  });

  it("sends no invitation when GitHub does not return a numeric id", async () => {
    fake.pending = [row("octocat")];
    fake.action = "a";
    fake.ghId = "583231; id\n";
    await run();

    expect(ghCalls()).toEqual(["gh api /users/octocat --jq .id"]);
    expect(updates()).toEqual([]);
  });

  it("prints a value from the form without its control characters", async () => {
    fake.pending = [row("octo\u001b[2Kcat", "you\r@example.com")];
    await run();

    const printed = vi.mocked(console.log).mock.calls.flat().join("\n") + fake.questions.join("\n");
    expect(printed).not.toMatch(/\u001b|\r/);
    expect(printed).toContain("octo?[2Kcat");
  });
});
