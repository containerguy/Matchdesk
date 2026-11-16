/* @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { EventInfoChannels } from "./EventInfoChannels";
import { I18nProvider } from "../i18n/I18nContext";
import { requestJson } from "../api/request";

vi.mock("../api/request", () => ({ requestJson: vi.fn() }));

const channel = (id: string, moduleId: string | null, available: boolean) => ({
  id,
  label: { de: id, en: id },
  moduleId,
  enabled: true,
  available,
  unavailableHint: available ? null : { de: "fehlt", en: "missing" }
});

describe("EventInfoChannels", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("zeigt bei fehlendem Kanal eine Einrichten-Aktion zum Profilbereich", async () => {
    vi.mocked(requestJson).mockImplementation(async (path: string) => {
      if (path === "/api/notifications/channels") {
        return {
          unsubscribed: false,
          channels: [channel("email", null, true), channel("push", null, false), channel("telegram", "telegram", false)]
        };
      }
      if (path === "/api/modules") return { modules: [{ id: "telegram", profile: { label: "Telegram" } }] };
      return {};
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <I18nProvider locale="de">
          <EventInfoChannels />
        </I18nProvider>
      );
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    const hrefs = Array.from(container.querySelectorAll("a.button-link")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("#login/m-telegram");
    expect(hrefs).toContain("#login/geraete");
    expect(container.querySelectorAll(".device-row")).toHaveLength(3);
  });
});
