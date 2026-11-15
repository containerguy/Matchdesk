/* @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ModuleEventNotices } from "./runtime";
import type { RuntimeModuleInfo } from "./types";
import type { User } from "../types/core";

const user: User = {
  id: "u-1",
  phoneNumber: "+491700000000",
  username: "anna",
  displayName: "Anna",
  email: "anna@example.test",
  role: "user",
  notificationsEnabled: false,
  locale: "de",
  deletedAt: null
} as unknown as User;

/** Baut eine eindeutige `data:`-URL für client.mjs, damit der Modul-Cache in `runtime.ts` Tests nicht mischt. */
function clientModuleUrl(body: string, nonce: string) {
  const src = `// ${nonce}\n${body}`;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`;
}

function moduleInfo(overrides: Partial<RuntimeModuleInfo> & { clientUrl: string }): RuntimeModuleInfo {
  return {
    id: "demo",
    version: "1.0.0",
    name: "Demo",
    adminPage: false,
    eventNotice: true,
    permissions: [],
    menu: [],
    i18n: { de: {}, en: {} },
    ...overrides
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function render(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(element);
    await flush();
  });
  return {
    container,
    rerender: async (next: React.ReactElement) => {
      await act(async () => {
        root.render(next);
        await flush();
      });
    },
    cleanup: async () => {
      await act(async () => {
        root.unmount();
        await flush();
      });
      container.remove();
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ModuleEventNotices", () => {
  it("rendert nichts ohne Module – die Karte bleibt unverändert", async () => {
    const rendered = await render(
      <div className="main-event">
        <span>Karteninhalt</span>
        <ModuleEventNotices modules={[]} locale="de" user={user} mainEventId="m-1" myParticipation={null} />
      </div>
    );
    expect(rendered.container.innerHTML).toBe("<div class=\"main-event\"><span>Karteninhalt</span></div>");
    await rendered.cleanup();
  });

  it("rendert den Hinweis mit der mainEventId und myParticipation der jeweiligen Karte", async () => {
    const url = clientModuleUrl(
      `export default (host) => ({
        EventNotice: (props) => host.React.createElement(
          "span",
          { className: "event-notice-demo" },
          "event=" + props.mainEventId + " status=" + props.myParticipation
        )
      });`,
      "richtige-props"
    );
    const info = moduleInfo({ clientUrl: url });

    const rendered = await render(
      <>
        <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-1" myParticipation="joined" />
        <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-2" myParticipation={null} />
      </>
    );
    const notices = Array.from(rendered.container.querySelectorAll(".event-notice-demo")).map((el) => el.textContent);
    expect(notices).toEqual(["event=m-1 status=joined", "event=m-2 status=null"]);
    await rendered.cleanup();
  });

  it("zeigt kein Modul ohne das Kennzeichen eventNotice", async () => {
    const url = clientModuleUrl(
      `export default (host) => ({
        EventNotice: () => host.React.createElement("span", { className: "event-notice-demo" }, "x")
      });`,
      "ohne-kennzeichen"
    );
    const info = moduleInfo({ clientUrl: url, eventNotice: false });
    const rendered = await render(
      <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-1" myParticipation={null} />
    );
    await flush();
    expect(rendered.container.querySelector(".event-notice-demo")).toBeNull();
    await rendered.cleanup();
  });

  it("lässt die Karte stehen, wenn das Modul abstürzt – kein roter Fehlerblock, nur Konsole", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const url = clientModuleUrl(
      `export default (host) => ({
        EventNotice: () => { throw new Error("kaputt"); }
      });`,
      "abstuerzend"
    );
    const info = moduleInfo({ clientUrl: url });

    const rendered = await render(
      <div className="main-event">
        <span>Karteninhalt</span>
        <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-1" myParticipation={null} />
      </div>
    );
    expect(rendered.container.textContent).toBe("Karteninhalt");
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain("abgestürzt");
    expect(consoleError).toHaveBeenCalled();
    await rendered.cleanup();
  });

  it("rendert neu, wenn sich die Teilnahme der Karte ändert, ohne dass die Seite neu lädt", async () => {
    const url = clientModuleUrl(
      `export default (host) => ({
        EventNotice: (props) => host.React.createElement("span", { className: "event-notice-demo" }, String(props.myParticipation))
      });`,
      "re-render-teilnahme"
    );
    const info = moduleInfo({ clientUrl: url });

    const rendered = await render(
      <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-1" myParticipation={null} />
    );
    expect(rendered.container.querySelector(".event-notice-demo")?.textContent).toBe("null");

    await rendered.rerender(
      <ModuleEventNotices modules={[info]} locale="de" user={user} mainEventId="m-1" myParticipation="joined" />
    );
    expect(rendered.container.querySelector(".event-notice-demo")?.textContent).toBe("joined");
    await rendered.cleanup();
  });
});
