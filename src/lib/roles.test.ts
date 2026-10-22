import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MEMBER_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  canComment,
  canEdit,
  canManage,
  canView,
  isMemberRole,
  maxRole,
  roleRank,
  safeNextPath,
  type Role,
} from "./roles.ts";

const ALL_ROLES: Role[] = ["owner", "editor", "commenter", "viewer"];

describe("role capabilities", () => {
  it("every role can view", () => {
    for (const r of ALL_ROLES) assert.equal(canView(r), true);
  });

  it("commenting starts at commenter", () => {
    assert.equal(canComment("owner"), true);
    assert.equal(canComment("editor"), true);
    assert.equal(canComment("commenter"), true);
    assert.equal(canComment("viewer"), false);
  });

  it("editing starts at editor (commenter cannot restructure)", () => {
    assert.equal(canEdit("owner"), true);
    assert.equal(canEdit("editor"), true);
    assert.equal(canEdit("commenter"), false);
    assert.equal(canEdit("viewer"), false);
  });

  it("only the owner manages access", () => {
    assert.equal(canManage("owner"), true);
    assert.equal(canManage("editor"), false);
    assert.equal(canManage("commenter"), false);
    assert.equal(canManage("viewer"), false);
  });

  it("rank orders the ladder monotonically", () => {
    assert.ok(roleRank("viewer") < roleRank("commenter"));
    assert.ok(roleRank("commenter") < roleRank("editor"));
    assert.ok(roleRank("editor") < roleRank("owner"));
  });

  it("maxRole never demotes (an editor opening a viewer invite stays editor)", () => {
    assert.equal(maxRole("editor", "viewer"), "editor");
    assert.equal(maxRole("viewer", "editor"), "editor");
    assert.equal(maxRole("commenter", "commenter"), "commenter");
    assert.equal(maxRole("owner", "viewer"), "owner");
  });

  it("labels exist for every role", () => {
    for (const r of ALL_ROLES) {
      assert.ok(ROLE_LABEL[r].length > 0);
      assert.ok(ROLE_DESCRIPTION[r].length > 0);
    }
  });
});

describe("isMemberRole", () => {
  it("accepts the three hand-outable roles", () => {
    for (const r of MEMBER_ROLES) assert.equal(isMemberRole(r), true);
  });

  it("rejects owner and junk", () => {
    assert.equal(isMemberRole("owner"), false);
    assert.equal(isMemberRole("admin"), false);
    assert.equal(isMemberRole(""), false);
    assert.equal(isMemberRole("Viewer"), false); // case-sensitive
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeNextPath("/app"), "/app");
    assert.equal(safeNextPath("/invite/abc123"), "/invite/abc123");
    assert.equal(safeNextPath("/app/trees/x?tab=1"), "/app/trees/x?tab=1");
    assert.equal(safeNextPath("/invite/a%20b"), "/invite/a%20b");
  });

  it("falls back when missing or empty", () => {
    assert.equal(safeNextPath(null), "/app");
    assert.equal(safeNextPath(undefined), "/app");
    assert.equal(safeNextPath(""), "/app");
    assert.equal(safeNextPath("  "), "/app");
  });

  it("blocks open-redirect shapes", () => {
    assert.equal(safeNextPath("https://evil.example"), "/app");
    assert.equal(safeNextPath("http://evil.example/x"), "/app");
    assert.equal(safeNextPath("//evil.example"), "/app"); // protocol-relative
    assert.equal(safeNextPath("/\\evil.example"), "/app"); // backslash trick
    assert.equal(safeNextPath("\\/evil.example"), "/app");
    assert.equal(safeNextPath("app"), "/app"); // must start with /
    assert.equal(safeNextPath("mailto:x@y.z"), "/app");
  });

  it("blocks control characters (header injection)", () => {
    assert.equal(safeNextPath("/app\r\nSet-Cookie: x=1"), "/app");
    assert.equal(safeNextPath("/app\u0000"), "/app");
    assert.equal(safeNextPath("/in\u2028vite"), "/app");
  });

  it("honours a custom fallback", () => {
    assert.equal(safeNextPath("https://evil.example", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("/ok", "/dashboard"), "/ok");
  });

  it("rejects absurdly long inputs", () => {
    assert.equal(safeNextPath("/" + "a".repeat(5000)), "/app");
  });
});
