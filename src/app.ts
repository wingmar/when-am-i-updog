import { formatBlockTimeWindow } from "./adapters/base";
import { getAdapter } from "./adapters/registry";
import type { EventConfig, NormalizedRun } from "./types";

export class App {
  private events: EventConfig[] = [];
  private activeEvent: EventConfig | null = null;
  private handlersMap = new Map<string, { name: string; dogs: Set<string>; runs: NormalizedRun[] }>();
  private allHandlers: { name: string; dogs: Set<string>; runs: NormalizedRun[] }[] = [];
  private selectedHandler: string | null = null;
  private selectedDog: string | null = null;
  private selectedDay = "all";
  private selectedField = "all";
  private lastUpdated: Date | null = null;
  private isFetching = false;
  private refreshIntervalMs = 300000; // 5 minutes

  async init(): Promise<void> {
    this.setupTheme();
    this.setupEventListeners();

    try {
      const resp = await fetch("./events.json");
      this.events = await resp.json();
    } catch (e) {
      console.warn("Could not load events.json, using defaults", e);
      this.events = [
        {
          id: "northeast-classic",
          name: "Northeast Classic 2026",
          sheetId: "11zydir3gG2eQOFpk_N9yVxEW6iRYmbRtJAdeS1R9feI",
          adapterType: "NortheastClassic",
          days: ["Thursday", "Friday", "Saturday", "Sunday"]
        },
        {
          id: "fall-classic",
          name: "Fall Classic",
          sheetId: "1eDBrcZdUCiIg9hSWnGC0LP0Rds1bVTpNSnE2mjAInE8",
          adapterType: "FallClassic",
          days: ["Friday (9/20)", "Saturday (9/21)", "Sunday (9/22)"]
        }
      ];
    }

    const urlEventId = this.getQueryParam("event");
    const savedEventId = urlEventId || localStorage.getItem("updog_active_event");
    const initialEvent = this.events.find((e) => e.id === savedEventId) || this.events[0];

    this.activeEvent = initialEvent;
    const label = document.getElementById("activeEventLabel");
    if (label) label.textContent = `📍 ${initialEvent.name}`;

    this.loadActiveEvent(false);

    // Auto-refresh: 5 min timer (visible only)
    setInterval(() => {
      if (document.visibilityState === "visible") {
        this.loadActiveEvent(false);
      }
    }, this.refreshIntervalMs);

    // Wake / focus handler with 90s cooldown
    const handleWake = () => {
      if (!this.lastUpdated || Date.now() - this.lastUpdated.getTime() > 90000) {
        this.loadActiveEvent(false);
      }
    };
    window.addEventListener("focus", handleWake);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleWake();
    });
  }

  async loadActiveEvent(manual = false): Promise<void> {
    if (!this.activeEvent || this.isFetching) return;
    this.isFetching = true;

    const dot = document.getElementById("syncDot");
    const text = document.getElementById("syncText");
    const refreshBtn = document.getElementById("refreshBtn");
    const loadingMsg = document.getElementById("loadingMsg");

    if (dot) dot.className = "badge-dot syncing";
    if (text) text.textContent = "Syncing...";
    if (refreshBtn) refreshBtn.classList.add("spinning");

    if (manual) this.showToast(`Syncing ${this.activeEvent.name}...`);

    try {
      const adapter = getAdapter(this.activeEvent.adapterType);
      const runs = await adapter.fetchSchedule(this.activeEvent.sheetId, (done, total) => {
        if (loadingMsg) loadingMsg.textContent = `Loading event sheets (${done}/${total})...`;
      });

      // Build handler index
      const map = new Map<string, { name: string; dogs: Set<string>; runs: NormalizedRun[] }>();
      runs.forEach((r) => {
        if (!map.has(r.handler)) {
          map.set(r.handler, {
            name: r.handler,
            dogs: new Set(),
            runs: []
          });
        }
        const hData = map.get(r.handler)!;
        if (r.dog) hData.dogs.add(r.dog);
        hData.runs.push(r);
      });

      // Sort each handler's runs strictly using natural properties
      map.forEach((hData) => {
        hData.runs.sort(
          (a, b) => a.dayOrder - b.dayOrder || a.blockMinutes - b.blockMinutes || a.ordinalInBlock - b.ordinalInBlock
        );
      });

      this.handlersMap = map;
      this.allHandlers = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      this.lastUpdated = new Date();

      const loadingState = document.getElementById("loadingState");
      const appContent = document.getElementById("appContent");
      if (loadingState) loadingState.style.display = "none";
      if (appContent) appContent.style.display = "block";

      this.updateSyncBadge();
      this.renderPopularChips();

      const hashParam = this.getHashParam("handler");
      const savedHandler = hashParam || localStorage.getItem("updog_selected_handler");
      if (savedHandler && this.handlersMap.has(savedHandler)) {
        this.selectHandler(savedHandler);
      } else {
        this.clearHandlerSelection();
      }

      if (manual) this.showToast(`Updated ${runs.length} runs`);
    } catch (err) {
      console.error("Error loading event:", err);
      if (dot) dot.className = "badge-dot error";
      if (text) text.textContent = "Sync error";
      if (manual) this.showToast("Connection failed. Check network.");
    } finally {
      this.isFetching = false;
      if (refreshBtn) refreshBtn.classList.remove("spinning");
    }
  }

  switchEvent(eventId: string): void {
    const ev = this.events.find((e) => e.id === eventId);
    if (!ev) return;
    this.activeEvent = ev;
    localStorage.setItem("updog_active_event", ev.id);
    this.setQueryParam("event", ev.id);

    const label = document.getElementById("activeEventLabel");
    if (label) label.textContent = `📍 ${ev.name}`;
    this.closeEventDropdown();

    const loadingState = document.getElementById("loadingState");
    const appContent = document.getElementById("appContent");
    if (loadingState) loadingState.style.display = "block";
    if (appContent) appContent.style.display = "none";

    this.loadActiveEvent(true);
  }

  renderEventDropdown(): void {
    const dd = document.getElementById("eventDropdown");
    if (!dd || !this.activeEvent) return;
    dd.innerHTML = this.events
      .map(
        (ev) => `
        <li class="event-dropdown-item ${ev.id === this.activeEvent!.id ? "active" : ""}" data-event-id="${ev.id}">
          <span>${this.escapeHtml(ev.name)}</span>
          ${ev.id === this.activeEvent!.id ? "<span>✓</span>" : ""}
        </li>
      `
      )
      .join("");

    dd.querySelectorAll(".event-dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-event-id");
        if (id) this.switchEvent(id);
      });
    });
  }

  toggleEventDropdown(): void {
    const dd = document.getElementById("eventDropdown");
    if (!dd) return;
    const isOpen = dd.style.display === "block";
    dd.style.display = isOpen ? "none" : "block";
    if (!isOpen) this.renderEventDropdown();
  }

  closeEventDropdown(): void {
    const dd = document.getElementById("eventDropdown");
    if (dd) dd.style.display = "none";
  }

  selectHandler(name: string): void {
    if (!this.handlersMap.has(name)) return;
    this.selectedHandler = name;
    this.selectedDog = null;
    this.selectedDay = "all";
    this.selectedField = "all";
    localStorage.setItem("updog_selected_handler", name);
    this.setHashParam("handler", name);

    const input = document.getElementById("handlerSearch") as HTMLInputElement | null;
    if (input) input.value = name;
    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn) clearBtn.style.display = "grid";
    this.closeSuggestions();

    this.renderSchedule();
  }

  clearHandlerSelection(): void {
    this.selectedHandler = null;
    this.selectedDog = null;
    this.selectedDay = "all";
    this.selectedField = "all";
    localStorage.removeItem("updog_selected_handler");
    this.setHashParam("handler", null);

    const input = document.getElementById("handlerSearch") as HTMLInputElement | null;
    if (input) input.value = "";
    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn) clearBtn.style.display = "none";
    this.closeSuggestions();

    this.renderSchedule();
  }

  selectDog(dog: string | null): void {
    this.selectedDog = dog;
    this.renderSchedule();
  }

  selectDay(day: string): void {
    this.selectedDay = day;
    this.renderSchedule();
  }

  selectField(field: string): void {
    this.selectedField = field;
    this.renderSchedule();
  }

  renderPopularChips(): void {
    const container = document.getElementById("popularChips");
    if (!container) return;
    const sorted = [...this.allHandlers].sort((a, b) => b.runs.length - a.runs.length).slice(0, 8);

    container.innerHTML = sorted
      .map(
        (h) => `
        <button class="popular-chip" data-name="${this.escapeHtml(h.name)}">
          ${this.escapeHtml(h.name)} (${h.runs.length})
        </button>
      `
      )
      .join("");

    container.querySelectorAll(".popular-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-name");
        if (name) this.selectHandler(name);
      });
    });
  }

  renderSchedule(): void {
    const welcome = document.getElementById("welcomeState");
    const profile = document.getElementById("profileContainer");
    const schedule = document.getElementById("scheduleContainer");

    if (!this.selectedHandler || !this.handlersMap.has(this.selectedHandler) || !this.activeEvent) {
      if (welcome) welcome.style.display = "block";
      if (profile) profile.style.display = "none";
      if (schedule) schedule.innerHTML = "";
      return;
    }

    if (welcome) welcome.style.display = "none";
    if (profile) profile.style.display = "block";

    const handlerData = this.handlersMap.get(this.selectedHandler)!;
    const allRuns = handlerData.runs;
    const dogs = Array.from(handlerData.dogs).sort();

    const activeDays = this.activeEvent.days.filter((d) => allRuns.some((r) => r.day === d));
    const activeFields = Array.from(new Set(allRuns.map((r) => r.field))).sort();

    let filteredRuns = allRuns;
    if (this.selectedDog) {
      filteredRuns = filteredRuns.filter((r) => r.dog === this.selectedDog);
    }
    if (this.selectedDay !== "all") {
      filteredRuns = filteredRuns.filter((r) => r.day === this.selectedDay);
    }
    if (this.selectedField !== "all") {
      filteredRuns = filteredRuns.filter((r) => r.field === this.selectedField);
    }

    if (profile) {
      profile.innerHTML = `
        <div class="profile-card">
          <div class="profile-header">
            <div>
              <h2 class="profile-title">${this.escapeHtml(handlerData.name)}</h2>
              <div class="profile-stats">
                <span class="stat-chip">${allRuns.length} Total Runs</span>
                <span class="stat-chip">${dogs.length} ${dogs.length === 1 ? "Dog" : "Dogs"}</span>
                <span class="stat-chip">${activeDays.length} Competition ${activeDays.length === 1 ? "Day" : "Days"}</span>
              </div>
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-group">
              <span class="filter-label">Day</span>
              <div class="filter-strip">
                <button class="filter-btn ${this.selectedDay === "all" ? "active" : ""}" data-day="all">
                  <span>All Days</span>
                  <span class="filter-count">${this.selectedDog ? allRuns.filter((r) => r.dog === this.selectedDog).length : allRuns.length}</span>
                </button>
                ${activeDays
                  .map((d) => {
                    const dayRuns = allRuns.filter((r) => r.day === d && (!this.selectedDog || r.dog === this.selectedDog));
                    return `
                      <button class="filter-btn ${this.selectedDay === d ? "active" : ""}" data-day="${d}">
                        <span>${d}</span>
                        <span class="filter-count">${dayRuns.length}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            ${
              dogs.length > 1
                ? `
              <div class="filter-group">
                <span class="filter-label">Dog</span>
                <div class="filter-strip">
                  <button class="filter-btn ${this.selectedDog === null ? "active" : ""}" data-dog="all">
                    <span>All Dogs</span>
                  </button>
                  ${dogs
                    .map((dog) => {
                      const count = allRuns.filter((r) => r.dog === dog && (this.selectedDay === "all" || r.day === this.selectedDay)).length;
                      return `
                        <button class="filter-btn ${this.selectedDog === dog ? "active" : ""}" data-dog="${this.escapeHtml(dog)}">
                          <span>🐾 ${this.escapeHtml(dog)}</span>
                          <span class="filter-count">${count}</span>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            ${
              activeFields.length > 1
                ? `
              <div class="filter-group">
                <span class="filter-label">Field</span>
                <div class="filter-strip">
                  <button class="filter-btn ${this.selectedField === "all" ? "active" : ""}" data-field="all">
                    <span>All Fields</span>
                  </button>
                  ${activeFields
                    .map(
                      (f) => `
                    <button class="filter-btn ${this.selectedField === f ? "active" : ""}" data-field="${this.escapeHtml(f)}">
                      <span>${this.escapeHtml(f)}</span>
                    </button>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;

      // Attach filter event listeners
      profile.querySelectorAll("[data-day]").forEach((btn) => {
        btn.addEventListener("click", () => this.selectDay(btn.getAttribute("data-day")!));
      });
      profile.querySelectorAll("[data-dog]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dog = btn.getAttribute("data-dog");
          this.selectDog(dog === "all" ? null : dog);
        });
      });
      profile.querySelectorAll("[data-field]").forEach((btn) => {
        btn.addEventListener("click", () => this.selectField(btn.getAttribute("data-field")!));
      });
    }

    if (!schedule) return;

    if (filteredRuns.length === 0) {
      schedule.innerHTML = `
        <div class="empty-state">
          <p>No runs match the current filter selection.</p>
        </div>
      `;
      return;
    }

    let currentDay: string | null = null;
    let html = "";

    for (let i = 0; i < filteredRuns.length; i++) {
      const run = filteredRuns[i];
      const prevRun = i > 0 ? filteredRuns[i - 1] : null;

      if (run.day !== currentDay) {
        if (currentDay !== null) html += `</div>`;
        currentDay = run.day;
        html += `
          <div class="day-header">
            <span>${run.day}</span>
            <span class="day-line"></span>
          </div>
          <div class="run-list">
        `;
      }

      if (prevRun && prevRun.day === run.day) {
        const gapMin = run.blockMinutes - prevRun.blockMinutes;
        if (gapMin >= 45) {
          const hrs = Math.floor(gapMin / 60);
          const mins = gapMin % 60;
          const gapStr = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ""}` : `${mins}m`;
          html += `
            <div class="break-indicator">
              <span class="break-line"></span>
              <span>${gapStr} break</span>
              <span class="break-line"></span>
            </div>
          `;
        }
      }

      const blockTime = formatBlockTimeWindow(run.blockTime);
      const fieldClass = this.getFieldClass(run.field);

      let tightTurnaroundNotice: string | null = null;
      for (const other of allRuns) {
        if (other !== run && other.day === run.day && other.blockTime === run.blockTime) {
          if (other.field === run.field) {
            const diff = Math.abs(run.ordinalInBlock - other.ordinalInBlock);
            tightTurnaroundNotice = `Same block as ${other.dog} (${diff} spot${diff === 1 ? "" : "s"} apart)`;
          } else {
            tightTurnaroundNotice = `Concurrent: ${other.dog} on ${other.field}`;
          }
          break;
        }
      }

      html += `
        <div class="mobile-run-card ${tightTurnaroundNotice ? "has-conflict" : ""}">
          <div class="card-top-bar">
            <div class="block-time-group">
              <span class="block-time-val">${blockTime.start.formatted}</span>
              <span class="block-time-period">${blockTime.start.period}</span>
            </div>
            <div class="card-badges-right">
              <span class="ordinal-pill">#${run.ordinalInBlock} of ${run.totalInBlock}</span>
              <span class="field-pill ${fieldClass}">${this.escapeHtml(run.field)}</span>
            </div>
          </div>

          <div class="card-main-info">
            <h4 class="game-title">${this.escapeHtml(run.game)}</h4>
            <div class="dog-specs-row">
              <span class="dog-badge">
                <span>🐾</span>
                <span>${this.escapeHtml(run.dog || "Unassigned")}</span>
              </span>
            </div>
          </div>

          <div class="card-footer">
            <span class="block-range-text">
              🕒 ${blockTime.range} Block
            </span>
            ${
              tightTurnaroundNotice
                ? `
              <span class="conflict-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                ${this.escapeHtml(tightTurnaroundNotice)}
              </span>
            `
                : ""
            }
          </div>
        </div>
      `;
    }

    if (currentDay !== null) html += `</div>`;
    schedule.innerHTML = html;
  }

  private getFieldClass(field: string): string {
    if (!field) return "field-1";
    const cleaned = field.toLowerCase();
    if (cleaned.includes("2/3")) return "field-23";
    if (cleaned.includes("3")) return "field-3";
    if (cleaned.includes("2")) return "field-2";
    return "field-1";
  }

  private setupEventListeners(): void {
    const searchInput = document.getElementById("handlerSearch") as HTMLInputElement | null;
    const clearBtn = document.getElementById("searchClearBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const shareBtn = document.getElementById("shareBtn");
    const themeBtn = document.getElementById("themeBtn");
    const eventSelectBtn = document.getElementById("eventSelectBtn");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = q ? "grid" : "none";
        if (!q) {
          this.closeSuggestions();
          return;
        }

        const matches: { name: string; runsCount: number; dogs: string[]; matchedDog: string | null }[] = [];
        for (const h of this.allHandlers) {
          const handlerMatch = h.name.toLowerCase().includes(q);
          const matchingDogs = Array.from(h.dogs).filter((d) => d.toLowerCase().includes(q));
          if (handlerMatch || matchingDogs.length > 0) {
            matches.push({
              name: h.name,
              runsCount: h.runs.length,
              dogs: Array.from(h.dogs),
              matchedDog: !handlerMatch && matchingDogs.length > 0 ? matchingDogs[0] : null
            });
          }
        }
        this.renderSuggestions(matches);
      });

      searchInput.addEventListener("focus", (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        if (val) {
          e.target!.dispatchEvent(new Event("input"));
        } else {
          const top = this.allHandlers.slice(0, 10);
          this.renderSuggestions(
            top.map((h) => ({
              name: h.name,
              runsCount: h.runs.length,
              dogs: Array.from(h.dogs),
              matchedDog: null
            }))
          );
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearHandlerSelection());
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadActiveEvent(true));
    }
    if (shareBtn) {
      shareBtn.addEventListener("click", () => this.copyShareLink());
    }
    if (themeBtn) {
      themeBtn.addEventListener("click", () => this.toggleTheme());
    }
    if (eventSelectBtn) {
      eventSelectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleEventDropdown();
      });
    }

    document.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest(".search-section")) {
        this.closeSuggestions();
      }
      if (!(e.target as HTMLElement).closest(".event-bar")) {
        this.closeEventDropdown();
      }
    });
  }

  private renderSuggestions(items: { name: string; runsCount: number; dogs: string[]; matchedDog: string | null }[]): void {
    const list = document.getElementById("suggestionsList");
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = `<li class="suggestion-item"><span class="suggestion-meta">No matching handlers or dogs</span></li>`;
      list.style.display = "block";
      return;
    }

    list.innerHTML = items
      .slice(0, 15)
      .map(
        (item) => `
        <li class="suggestion-item" data-name="${this.escapeHtml(item.name)}">
          <div>
            <div class="suggestion-name">${this.escapeHtml(item.name)}</div>
            <div class="suggestion-meta">
              ${item.matchedDog ? `Matches dog: 🐾 <strong>${this.escapeHtml(item.matchedDog)}</strong> &bull; ` : ""}
              ${this.escapeHtml(item.dogs.join(", "))}
            </div>
          </div>
          <span class="suggestion-meta">${item.runsCount} runs</span>
        </li>
      `
      )
      .join("");

    list.querySelectorAll(".suggestion-item").forEach((li) => {
      li.addEventListener("click", () => {
        const name = li.getAttribute("data-name");
        if (name) this.selectHandler(name);
      });
    });

    list.style.display = "block";
  }

  private closeSuggestions(): void {
    const list = document.getElementById("suggestionsList");
    if (list) list.style.display = "none";
  }

  private updateSyncBadge(): void {
    const dot = document.getElementById("syncDot");
    const text = document.getElementById("syncText");
    if (!dot || !text) return;
    dot.className = "badge-dot";

    if (this.lastUpdated) {
      const timeStr = this.lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      text.textContent = `Synced ${timeStr}`;
    } else {
      text.textContent = "Live";
    }
  }

  private showToast(msg: string): void {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerHTML = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  }

  private copyShareLink(): void {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        this.showToast(this.selectedHandler ? `Link copied for ${this.selectedHandler}` : "Link copied to clipboard");
      })
      .catch(() => this.showToast("Unable to copy link"));
  }

  private setupTheme(): void {
    const saved = localStorage.getItem("updog_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    this.setTheme(saved);
  }

  private toggleTheme(): void {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    this.setTheme(next);
  }

  private setTheme(theme: string): void {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("updog_theme", theme);
    const moon = document.getElementById("moonIcon");
    const sun = document.getElementById("sunIcon");
    if (moon) moon.style.display = theme === "dark" ? "none" : "block";
    if (sun) sun.style.display = theme === "dark" ? "block" : "none";
  }

  private escapeHtml(str: string): string {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private getQueryParam(key: string): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  private setQueryParam(key: string, val: string | null): void {
    const params = new URLSearchParams(window.location.search);
    if (val) params.set(key, val);
    else params.delete(key);
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }

  private getHashParam(key: string): string | null {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return params.get(key);
    } catch {
      return null;
    }
  }

  private setHashParam(key: string, val: string | null): void {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    if (val) params.set(key, val);
    else params.delete(key);
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (params.toString() ? `#${params.toString()}` : ""));
  }
}
