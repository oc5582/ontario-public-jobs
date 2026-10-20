import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sourceUrl = new URL("../web/public/match.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");

const context: Record<string, unknown> = {
  console,
  document: {
    getElementById() {
      return null;
    },
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

const matchUnlockCopy = context.matchUnlockCopy as (shown: number, remaining: number) => {
  total: number;
  heading: string;
  text: string;
  button: string;
  note: string;
  href: string;
};
const renderMatchUnlock = context.renderMatchUnlock as (doc: FakeDoc, shown: number, remaining: number) => void;

const NOTE = "From CA$14.99/month plus GST/HST. Cancel anytime.";

function expectCopy(shown: number, remaining: number, total: number, top: number) {
  const totalLabel = total.toLocaleString("en-CA");
  const topLabel = top.toLocaleString("en-CA");
  const copy = matchUnlockCopy(shown, remaining);
  assert.equal(copy.total, total);
  assert.equal(copy.total, shown + remaining);
  assert.equal(copy.heading, `${totalLabel} jobs match your resume. You're seeing the top ${topLabel}.`);
  assert.equal(
    copy.text,
    `Become a member to see all ${totalLabel}, ranked by how well they fit you, and run a new match anytime (up to 20 a day).`,
  );
  assert.equal(copy.button, `See all ${totalLabel} matches`);
  assert.equal(copy.note, NOTE);
  assert.equal(copy.href, "/pricing/");
}

expectCopy(10, 37, 47, 10);
expectCopy(9, 1, 10, 9);
expectCopy(4, 0, 4, 4);
expectCopy(0, 12, 12, 0);
expectCopy(15, 5, 20, 10);
expectCopy(2, 1000, 1002, 2);
assert.equal(matchUnlockCopy(10.9, 1.2).total, 11);
assert.equal(matchUnlockCopy(-3, 4).total, 4);
assert.equal(matchUnlockCopy(8, -2).total, 8);

type FakeNode = {
  tagName: string;
  id: string;
  className: string;
  hidden: boolean;
  href: string;
  children: FakeNode[];
  parentNode: FakeNode | null;
  attributes: Record<string, string>;
  textContent: string;
  appendChild(child: FakeNode): FakeNode;
  replaceChildren(): void;
  insertBefore(child: FakeNode, ref: FakeNode | null): FakeNode;
  setAttribute(name: string, value: string): void;
};

type FakeDoc = {
  getElementById(id: string): FakeNode | null;
  createElement(tag: string): FakeNode;
};

function fakeDocument(): { doc: FakeDoc; parent: FakeNode; unlock: FakeNode } {
  const byId = new Map<string, FakeNode>();
  function createElement(tag: string): FakeNode {
    const node: FakeNode = {
      tagName: tag.toUpperCase(),
      id: "",
      className: "",
      hidden: false,
      href: "",
      children: [],
      parentNode: null,
      attributes: {},
      textContent: "",
      appendChild(child) {
        child.parentNode = node;
        node.children.push(child);
        return child;
      },
      replaceChildren() {
        node.children = [];
      },
      insertBefore(child, ref) {
        child.parentNode = node;
        const index = ref ? node.children.indexOf(ref) : -1;
        if (index < 0) node.children.push(child);
        else node.children.splice(index, 0, child);
        return child;
      },
      setAttribute(name, value) {
        node.attributes[name] = String(value);
      },
    };
    let id = "";
    Object.defineProperty(node, "id", {
      get() {
        return id;
      },
      set(value: string) {
        if (id && byId.get(id) === node) byId.delete(id);
        id = String(value);
        if (id) byId.set(id, node);
      },
    });
    return node;
  }
  const doc: FakeDoc = {
    getElementById(id) {
      return byId.get(id) || null;
    },
    createElement,
  };
  const parent = createElement("div");
  const unlock = createElement("section");
  unlock.id = "unlock";
  unlock.className = "unlock";
  unlock.hidden = true;
  parent.appendChild(unlock);
  return { doc, parent, unlock };
}

function child(node: FakeNode, index: number): FakeNode {
  const found = node.children[index];
  assert.ok(found);
  return found;
}

const rendered = fakeDocument();
renderMatchUnlock(rendered.doc, 10, 37);
assert.equal(rendered.unlock.hidden, false);
assert.equal(rendered.parent.children.length, 2);
assert.equal(rendered.parent.children[0].id, "locked-list");
assert.equal(rendered.parent.children[1], rendered.unlock);
const locked = rendered.parent.children[0];
assert.equal(locked.className, "results locked-results");
assert.equal(locked.attributes["aria-hidden"], "true");
assert.equal(locked.hidden, false);
assert.equal(locked.children.length, 5);
assert.equal(child(locked.children[0], 0).textContent, "Member-only match");
assert.equal(child(rendered.unlock, 0).textContent, "47 jobs match your resume. You're seeing the top 10.");
assert.equal(
  child(rendered.unlock, 1).textContent,
  "Become a member to see all 47, ranked by how well they fit you, and run a new match anytime (up to 20 a day).",
);
const actions = child(rendered.unlock, 2);
assert.equal(actions.className, "unlock-actions");
const link = child(actions, 0);
assert.equal(link.tagName, "A");
assert.equal(link.className, "apply-btn");
assert.equal(link.href, "/pricing/");
assert.equal(link.textContent, "See all 47 matches");
const note = child(rendered.unlock, 3);
assert.equal(note.className, "apply-note");
assert.equal(note.textContent, NOTE);

renderMatchUnlock(rendered.doc, 6, 3);
assert.equal(child(rendered.unlock, 0).textContent, "9 jobs match your resume. You're seeing the top 6.");
assert.equal(rendered.parent.children[0].children.length, 3);
assert.equal(rendered.unlock.children.length, 4);

const hidden = fakeDocument();
renderMatchUnlock(hidden.doc, 8, 0);
assert.equal(hidden.unlock.hidden, true);
assert.equal(hidden.unlock.children.length, 0);
assert.equal(hidden.parent.children[0].hidden, true);
assert.equal(hidden.parent.children[0].children.length, 0);

assert.match(source, /typeof data\.shown === "number" \? data\.shown/);
assert.match(source, /renderMatchUnlock\(document, shown, data\.locked \|\| 0\)/);
assert.match(source, /shownCount \+ remainingCount/);
assert.match(source, /link\.className = "apply-btn"/);
assert.match(source, /pjTrackMeta\("trackCustom", "MatchComplete"\)/);
assert.doesNotMatch(source, /See membership"\);\s*actions/);
