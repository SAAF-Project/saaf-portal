import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanGithubUsername, isEmail, isGithubUsername, printable, readSignup } from "./signup";

describe("a GitHub username", () => {
  it("accepts what GitHub accepts", () => {
    for (const name of ["a", "octocat", "Octo-Cat", "a1-b2-c3", "0x", "a".repeat(39)]) {
      expect(isGithubUsername(name), name).toBe(true);
    }
  });

  it("refuses everything else", () => {
    const refused = [
      "",
      " ",
      "-start",
      "end-",
      "two--hyphens",
      "a".repeat(40),
      "with space",
      "under_score",
      "dot.name",
      "name[bot]",
      "name\n",
      "name@example.com",
      "../orgs/SAAF-Project",
      "name/repos",
      "name?x=1",
      "$(id)",
      "`id`",
      "name;id",
      "name|id",
      "name&id",
      "name'",
      'name"',
      "ñame",
    ];
    for (const name of refused) expect(isGithubUsername(name), JSON.stringify(name)).toBe(false);
    for (const value of [undefined, null, 42, {}, ["octocat"]]) expect(isGithubUsername(value)).toBe(false);
  });

  it("is cleaned of spaces and one leading @, and nothing else", () => {
    expect(cleanGithubUsername("  @octocat ")).toBe("octocat");
    expect(cleanGithubUsername("octocat")).toBe("octocat");
    expect(cleanGithubUsername("name@example.com")).toBe("name@example.com");
    expect(cleanGithubUsername(undefined)).toBe("");
    expect(cleanGithubUsername(42)).toBe("");
  });
});

describe("a value printed in a terminal", () => {
  it("loses its control and direction characters", () => {
    expect(printable("plain-name")).toBe("plain-name");
    expect(printable("a\u001b[2Kb")).toBe("a?[2Kb");
    expect(printable("a\r\nb")).toBe("a??b");
    expect(printable("a‮b​c")).toBe("a?b?c");
  });

  it("is cut when it is long", () => {
    expect(printable("x".repeat(200))).toBe(`${"x".repeat(80)}...`);
  });
});

describe("an email address", () => {
  it("needs one @, a dot after it and no spaces or hidden characters", () => {
    expect(isEmail("you@example.com")).toBe(true);
    for (const value of ["", "you", "you@example", "you @example.com", "a@b@c.com", "you@exa\u001bmple.com", `${"a".repeat(250)}@b.co`]) {
      expect(isEmail(value), JSON.stringify(value)).toBe(false);
    }
  });
});

describe("a sign-up request", () => {
  it("takes a username, an email address or both", () => {
    expect(readSignup({ githubUsername: "@octocat" })).toEqual({ ok: true, githubUsername: "octocat", email: "" });
    expect(readSignup({ email: " you@example.com " })).toEqual({ ok: true, githubUsername: "", email: "you@example.com" });
    expect(readSignup({ githubUsername: "octocat", email: "you@example.com" })).toEqual({
      ok: true,
      githubUsername: "octocat",
      email: "you@example.com",
    });
  });

  it("reads an email address typed in the username field as the email address", () => {
    expect(readSignup({ githubUsername: "you@example.com" })).toEqual({ ok: true, githubUsername: "", email: "you@example.com" });
  });

  it("refuses an empty request and a body that is not an object", () => {
    for (const body of [{}, { githubUsername: "  " }, null, undefined, "octocat", 42, { githubUsername: ["octocat"] }]) {
      expect(readSignup(body).ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("refuses a username that is not one, also when the email address is fine", () => {
    for (const githubUsername of ["Jane Doe", "$(id)", "`id`", "a;b", "../x", "name\nother"]) {
      const result = readSignup({ githubUsername, email: "you@example.com" });
      expect(result.ok, JSON.stringify(githubUsername)).toBe(false);
    }
  });

  it("refuses an email address that is not one", () => {
    expect(readSignup({ githubUsername: "octocat", email: "not an address" }).ok).toBe(false);
  });
});

describe("the scripts in scripts/", () => {
  const dir = resolve(process.cwd(), "scripts");
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({ name, text: readFileSync(resolve(dir, name), "utf8") }));

  it("never hand a command line to a shell", () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const { name, text } of sources) {
      expect(/\bexecSync\b|(?<![.\w])exec\s*\(|shell\s*:\s*true/.test(text), name).toBe(false);
    }
  });

  it("check a sign-up's username before they use it", () => {
    const script = sources.find((s) => s.name === "process-signups.ts");
    expect(script?.text).toContain("isGithubUsername(");
    expect(script?.text).toContain("execFileSync(");
  });
});
