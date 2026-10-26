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
        v-model:selected-volunteer-only="selectedVolunteerOnly"
        v-model:selected-field="selectedField"
      />

      <!-- Runs List Grouped by Day -->
      <div v-if="selectedHandlerData">
        <div v-if="filteredItems.length === 0" class="empty-state">
          <p>No runs match the current filter selection.</p>
        </div>

        <div v-else>
          <div v-for="group in dayGroups" :key="group.day">
            <div class="day-header">
              <span>{{ group.day }}</span>
              <span class="day-line"></span>
            </div>

            <div class="run-list">
              <template v-for="entry in group.items" :key="entry.item.id">
                <!-- Break Indicator -->
                <div v-if="entry.breakNotice" class="break-indicator">
                  <span class="break-line"></span>
                  <span>{{ entry.breakNotice }}</span>
                  <span class="break-line"></span>
                </div>

                <!-- Polymorphic Dynamic Component: Zero v-if checks! -->
                <component
                  :is="activityCardMap[entry.item.activity.kind]"
                  :item="entry.item"
                  :tight-turnaround-notice="entry.conflictNotice"
                  :conflict-notice="entry.conflictNotice"
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
            {{ h.name }} ({{ h.items.length }})
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
import { activityCardMap } from "./components/activityRegistry";
import AppHeader from "./components/AppHeader.vue";
import ProfileCard from "./components/ProfileCard.vue";
import SearchBox from "./components/SearchBox.vue";
import type { EventConfig, ScheduleItem } from "./types";

const events = ref<EventConfig[]>([]);
const activeEvent = ref<EventConfig | null>(null);
const handlersMap = ref<Map<string, { name: string; dogs: Set<string>; items: ScheduleItem[] }>>(new Map());
const allHandlers = ref<{ name: string; dogs: Set<string>; items: ScheduleItem[] }[]>([]);

const selectedHandler = ref<string | null>(null);
const selectedDog = ref<string | null>(null);
const selectedVolunteerOnly = ref(false);
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
  return [...allHandlers.value].sort((a, b) => b.items.length - a.items.length).slice(0, 8);
});

const filteredItems = computed(() => {
  if (!selectedHandlerData.value) return [];
  let items = selectedHandlerData.value.items;

  if (selectedVolunteerOnly.value) {
    items = items.filter((i) => i.activity.kind === "volunteer");
  } else if (selectedDog.value) {
    items = items.filter((i) => i.activity.kind === "run" && i.activity.run.dog === selectedDog.value);
  }

  if (selectedDay.value !== "all") {
    items = items.filter((i) => i.day === selectedDay.value);
  }
  if (selectedField.value !== "all") {
    items = items.filter((i) => i.field === selectedField.value);
  }
  return items;
});

interface DayGroup {
  day: string;
  items: {
    item: ScheduleItem;
    breakNotice: string | null;
    conflictNotice: string | null;
  }[];
}

const dayGroups = computed<DayGroup[]>(() => {
  const groups: DayGroup[] = [];
  const items = filteredItems.value;
  const allHandlerItems = selectedHandlerData.value ? selectedHandlerData.value.items : [];

  let currentDay: string | null = null;
  let currentGroup: DayGroup | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prevItem = i > 0 ? items[i - 1] : null;

    if (item.day !== currentDay) {
      currentDay = item.day;
      currentGroup = { day: item.day, items: [] };
      groups.push(currentGroup);
    }

    // Break indicator
    let breakNotice: string | null = null;
    if (prevItem && prevItem.day === item.day) {
      const gapMin = item.blockMinutes - prevItem.blockMinutes;
      if (gapMin >= 45) {
        const hrs = Math.floor(gapMin / 60);
        const mins = gapMin % 60;
        breakNotice = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ""} break` : `${mins}m break`;
      }
    }

    // Cross-item Conflict Detection (Dog run vs Dog run tight turnaround OR Volunteer conflict)
    let conflictNotice: string | null = null;

    for (const other of allHandlerItems) {
      if (other.id === item.id || other.day !== item.day) continue;

      if (item.activity.kind === "run") {
        if (other.activity.kind === "volunteer") {
          // Check if dog run falls within volunteer shift window
          if (Math.abs(item.blockMinutes - other.blockMinutes) < 60) {
            conflictNotice = `⚠️ Conflict: Assigned to ${other.activity.shift.role}`;
            break;
          }
        } else if (other.activity.kind === "run") {
          // Dog-to-dog tight turnaround in same block
          if (other.blockTime === item.blockTime) {
            if (other.field === item.field) {
              const diff = Math.abs(item.activity.run.ordinalInBlock - other.activity.run.ordinalInBlock);
              conflictNotice = `Same block as ${other.activity.run.dog} (${diff} spot${diff === 1 ? "" : "s"} apart)`;
            } else {
              conflictNotice = `Concurrent: ${other.activity.run.dog} on ${other.field}`;
            }
            break;
          }
        }
      } else if (item.activity.kind === "volunteer") {
        if (other.activity.kind === "run") {
          if (Math.abs(item.blockMinutes - other.blockMinutes) < 60) {
            conflictNotice = `⚠️ Conflict: Running ${other.activity.run.dog} at ${other.blockTime}`;
            break;
          }
        }
      }
    }

    currentGroup?.items.push({
      item,
      breakNotice,
      conflictNotice
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
    const items = await adapter.fetchSchedule(activeEvent.value.sheetId, (done, total) => {
      loadingMsg.value = `Loading event sheets (${done}/${total})...`;
    });

    const map = new Map<string, { name: string; dogs: Set<string>; items: ScheduleItem[] }>();
    items.forEach((item) => {
      if (!map.has(item.handler)) {
        map.set(item.handler, {
          name: item.handler,
          dogs: new Set(),
          items: []
        });
      }
      const hData = map.get(item.handler)!;
      if (item.activity.kind === "run" && item.activity.run.dog) {
        hData.dogs.add(item.activity.run.dog);
      }
      hData.items.push(item);
    });

    // Natural sort: Day order -> block minutes -> ordinal
    map.forEach((hData) => {
      hData.items.sort((a, b) => {
        const ordA = a.activity.kind === "run" ? a.activity.run.ordinalInBlock : 0;
        const ordB = b.activity.kind === "run" ? b.activity.run.ordinalInBlock : 0;
        return a.dayOrder - b.dayOrder || a.blockMinutes - b.blockMinutes || ordA - ordB;
      });
    });

    handlersMap.value = map;
    allHandlers.value = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    lastUpdated.value = new Date();
    isLoadingInitial.value = false;

    // Check URL or storage handler
    const hash = window.location.hash.substring(1);
    const hashParam = new URLSearchParams(hash).get("handler");
    const savedHandler = hashParam || localStorage.getItem("updog_selected_handler");

    if (savedHandler && map.has(savedHandler)) {
      selectHandler(savedHandler);
    } else {
      clearHandlerSelection();
    }

    if (manual) showToast(`Updated ${items.length} entries`);
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

  const params = new URLSearchParams(window.location.search);
  params.set("event", ev.id);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);

  isLoadingInitial.value = true;
  loadActiveEvent(true);
}

function selectHandler(name: string) {
  selectedHandler.value = name;
  selectedDog.value = null;
  selectedVolunteerOnly.value = false;
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
  selectedVolunteerOnly.value = false;
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
  const savedTheme = (localStorage.getItem("updog_theme") as "light" | "dark") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  theme.value = savedTheme;
  document.documentElement.setAttribute("data-theme", savedTheme);

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
