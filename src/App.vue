<template>
  <AppHeader
    :events="events"
    :active-event="activeEvent"
    :is-fetching="isFetching"
    :sync-error="syncError"
    :last-updated="lastUpdated"
    :theme="theme"
    @select-event="switchEvent"
    @refresh="loadActiveEvent(true)"
    @share="copyShareLink"
    @toggle-theme="toggleTheme"
    @reset="clearHandlerSelection"
  />

  <main>
    <!-- Loading State -->
    <div v-if="isLoadingInitial" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ loadingMsg }}</p>
    </div>

    <!-- App Content -->
    <div v-else>
      <SearchBox
        v-model="searchQuery"
        :all-handlers="allHandlers"
        @select="selectHandler"
        @clear="clearHandlerSelection"
      />

      <!-- Handler Profile Card & Swipeable Filter Strips -->
      <ProfileCard
        v-if="selectedHandlerData && activeEvent"
        :handler-data="selectedHandlerData"
        :days-order="activeEvent.days"
        v-model:selected-day="selectedDay"
        v-model:selected-dog="selectedDog"
        v-model:selected-field="selectedField"
      />

      <!-- Runs List Grouped by Day -->
      <div v-if="selectedHandlerData">
        <div v-if="filteredRuns.length === 0" class="empty-state">
          <p>No runs match the current filter selection.</p>
        </div>

        <div v-else>
          <div v-for="group in dayGroups" :key="group.day">
            <div class="day-header">
              <span>{{ group.day }}</span>
              <span class="day-line"></span>
            </div>

            <div class="run-list">
              <template v-for="item in group.runs" :key="`${item.run.game}_${item.run.field}_${item.run.ordinalInBlock}`">
                <!-- Break Indicator -->
                <div v-if="item.breakNotice" class="break-indicator">
                  <span class="break-line"></span>
                  <span>{{ item.breakNotice }}</span>
                  <span class="break-line"></span>
                </div>

                <!-- Run Card Component -->
                <RunCard
                  :run="item.run"
                  :tight-turnaround-notice="item.tightTurnaroundNotice"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Welcome State (When No Handler Selected) -->
      <div v-else class="empty-state">
        <div class="empty-state-icon">🐾</div>
        <h3 class="empty-state-title">Select Your Name</h3>
        <p class="empty-state-subtitle">
          Search for your name or dog above to view your scheduled block times, block running orders, and fields.
        </p>
        <div class="popular-chips">
          <button
            v-for="h in topHandlers"
            :key="h.name"
            class="popular-chip"
            @click="selectHandler(h.name)"
          >
            {{ h.name }} ({{ h.runs.length }})
          </button>
        </div>
      </div>
    </div>
  </main>

  <!-- Toast Notification -->
  <div class="toast" :class="{ show: toastVisible }">
    {{ toastMessage }}
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getAdapter } from "./adapters/registry";
import AppHeader from "./components/AppHeader.vue";
import ProfileCard from "./components/ProfileCard.vue";
import RunCard from "./components/RunCard.vue";
import SearchBox from "./components/SearchBox.vue";
import type { EventConfig, NormalizedRun } from "./types";

const events = ref<EventConfig[]>([]);
const activeEvent = ref<EventConfig | null>(null);
const handlersMap = ref<Map<string, { name: string; dogs: Set<string>; runs: NormalizedRun[] }>>(new Map());
const allHandlers = ref<{ name: string; dogs: Set<string>; runs: NormalizedRun[] }[]>([]);

const selectedHandler = ref<string | null>(null);
const selectedDog = ref<string | null>(null);
const selectedDay = ref("all");
const selectedField = ref("all");

const searchQuery = ref("");
const isFetching = ref(false);
const syncError = ref(false);
const isLoadingInitial = ref(true);
const loadingMsg = ref("Loading running orders & block times...");
const lastUpdated = ref<Date | null>(null);

const theme = ref<"light" | "dark">("light");
const toastMessage = ref("");
const toastVisible = ref(false);

const selectedHandlerData = computed(() => {
  if (!selectedHandler.value) return null;
  return handlersMap.value.get(selectedHandler.value) || null;
});

const topHandlers = computed(() => {
  return [...allHandlers.value].sort((a, b) => b.runs.length - a.runs.length).slice(0, 8);
});

const filteredRuns = computed(() => {
  if (!selectedHandlerData.value) return [];
  let runs = selectedHandlerData.value.runs;
  if (selectedDog.value) {
    runs = runs.filter((r) => r.dog === selectedDog.value);
  }
  if (selectedDay.value !== "all") {
    runs = runs.filter((r) => r.day === selectedDay.value);
  }
  if (selectedField.value !== "all") {
    runs = runs.filter((r) => r.field === selectedField.value);
  }
  return runs;
});

interface DayGroup {
  day: string;
  runs: {
    run: NormalizedRun;
    breakNotice: string | null;
    tightTurnaroundNotice: string | null;
  }[];
}

const dayGroups = computed<DayGroup[]>(() => {
  const groups: DayGroup[] = [];
  const runs = filteredRuns.value;
  const allHandlerRuns = selectedHandlerData.value ? selectedHandlerData.value.runs : [];

  let currentDay: string | null = null;
  let currentGroup: DayGroup | null = null;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const prevRun = i > 0 ? runs[i - 1] : null;

    if (run.day !== currentDay) {
      currentDay = run.day;
      currentGroup = { day: run.day, runs: [] };
      groups.push(currentGroup);
    }

    // Break indicator
    let breakNotice: string | null = null;
    if (prevRun && prevRun.day === run.day) {
      const gapMin = run.blockMinutes - prevRun.blockMinutes;
      if (gapMin >= 45) {
        const hrs = Math.floor(gapMin / 60);
        const mins = gapMin % 60;
        breakNotice = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ""} break` : `${mins}m break`;
      }
    }

    // Tight Turnaround check across all dogs
    let tightTurnaroundNotice: string | null = null;
    for (const other of allHandlerRuns) {
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

    currentGroup?.runs.push({
      run,
      breakNotice,
      tightTurnaroundNotice
    });
  }

  return groups;
});

async function loadActiveEvent(manual = false) {
  if (!activeEvent.value || isFetching.value) return;
  isFetching.value = true;
  syncError.value = false;

  if (manual) showToast(`Syncing ${activeEvent.value.name}...`);

  try {
    const adapter = getAdapter(activeEvent.value.adapterType);
    const runs = await adapter.fetchSchedule(activeEvent.value.sheetId, (done, total) => {
      loadingMsg.value = `Loading event sheets (${done}/${total})...`;
    });

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

    // Natural sort: Day order -> block minutes -> ordinal in block
    map.forEach((hData) => {
      hData.runs.sort(
        (a, b) => a.dayOrder - b.dayOrder || a.blockMinutes - b.blockMinutes || a.ordinalInBlock - b.ordinalInBlock
      );
    });

    handlersMap.value = map;
    allHandlers.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    lastUpdated.value = new Date();
    isLoadingInitial.value = false;

    // Check if URL or storage handler exists in this event
    const hash = window.location.hash.substring(1);
    const hashParam = new URLSearchParams(hash).get("handler");
    const savedHandler = hashParam || localStorage.getItem("updog_selected_handler");

    if (savedHandler && map.has(savedHandler)) {
      selectHandler(savedHandler);
    } else {
      clearHandlerSelection();
    }

    if (manual) showToast(`Updated ${runs.length} runs`);
  } catch (err) {
    console.error("Error loading event:", err);
    syncError.value = true;
    if (manual) showToast("Connection failed. Check network.");
  } finally {
    isFetching.value = false;
  }
}

function switchEvent(eventId: string) {
  const ev = events.value.find((e) => e.id === eventId);
  if (!ev) return;
  activeEvent.value = ev;
  localStorage.setItem("updog_active_event", ev.id);

  // Update query param
  const params = new URLSearchParams(window.location.search);
  params.set("event", ev.id);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);

  isLoadingInitial.value = true;
  loadActiveEvent(true);
}

function selectHandler(name: string) {
  selectedHandler.value = name;
  selectedDog.value = null;
  selectedDay.value = "all";
  selectedField.value = "all";
  searchQuery.value = name;

  localStorage.setItem("updog_selected_handler", name);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  hashParams.set("handler", name);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hashParams.toString()}`);
}

function clearHandlerSelection() {
  selectedHandler.value = null;
  selectedDog.value = null;
  selectedDay.value = "all";
  selectedField.value = "all";
  searchQuery.value = "";

  localStorage.removeItem("updog_selected_handler");
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  hashParams.delete("handler");
  const hashStr = hashParams.toString() ? `#${hashParams.toString()}` : "";
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hashStr}`);
}

function showToast(msg: string) {
  toastMessage.value = msg;
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 2600);
}

function copyShareLink() {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      showToast(selectedHandler.value ? `Link copied for ${selectedHandler.value}` : "Link copied to clipboard");
    })
    .catch(() => showToast("Unable to copy link"));
}

function toggleTheme() {
  const next = theme.value === "dark" ? "light" : "dark";
  theme.value = next;
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("updog_theme", next);
}

onMounted(async () => {
  // Init Theme
  const savedTheme = (localStorage.getItem("updog_theme") as "light" | "dark") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  theme.value = savedTheme;
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Load events.json
  try {
    const resp = await fetch("./events.json");
    events.value = await resp.json();
  } catch (e) {
    console.warn("Could not load events.json, using defaults", e);
    events.value = [
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

  const urlParams = new URLSearchParams(window.location.search);
  const urlEventId = urlParams.get("event");
  const savedEventId = urlEventId || localStorage.getItem("updog_active_event");
  const initialEvent = events.value.find((e) => e.id === savedEventId) || events.value[0];
  activeEvent.value = initialEvent;

  await loadActiveEvent(false);

  // Background auto-refresh (5 minutes, visible only)
  setInterval(() => {
    if (document.visibilityState === "visible") {
      loadActiveEvent(false);
    }
  }, 300000);

  // Wake & focus handler with 90s cooldown
  const handleWake = () => {
    if (!lastUpdated.value || Date.now() - lastUpdated.value.getTime() > 90000) {
      loadActiveEvent(false);
    }
  };
  window.addEventListener("focus", handleWake);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") handleWake();
  });
});
</script>
