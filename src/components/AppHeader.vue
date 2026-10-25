<template>
  <header>
    <div class="header-inner">
      <a href="#" class="brand" @click.prevent="emit('reset')">
        <div class="brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
            <path d="M2 12h20"></path>
          </svg>
        </div>
        <span>When Am I UpDog?</span>
      </a>

      <div class="nav-actions">
        <span class="badge" id="syncStatus" title="Live sync status across all event sheets">
          <span class="badge-dot" :class="{ syncing: isFetching, error: syncError }"></span>
          <span>{{ syncText }}</span>
        </span>

        <button
          class="btn-icon"
          :class="{ spinning: isFetching }"
          title="Sync live updates from Google Sheet"
          @click="emit('refresh')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
            <path d="M16 21h5v-5"></path>
          </svg>
        </button>

        <button class="btn-icon" title="Copy personal link" @click="emit('share')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
        </button>

        <button class="btn-icon" title="Toggle dark mode" @click="emit('toggleTheme')">
          <svg v-if="theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Event Switcher -->
    <div class="event-bar" ref="eventBarRef">
      <button class="event-select-btn" @click="isDropdownOpen = !isDropdownOpen">
        <span>📍 {{ activeEvent?.name || "Loading Event..." }}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <ul class="event-dropdown" :style="{ display: isDropdownOpen ? 'block' : 'none' }">
        <li
          v-for="ev in events"
          :key="ev.id"
          class="event-dropdown-item"
          :class="{ active: ev.id === activeEvent?.id }"
          @click="selectEvent(ev.id)"
        >
          <span>{{ ev.name }}</span>
          <span v-if="ev.id === activeEvent?.id">✓</span>
        </li>
      </ul>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { EventConfig } from "../types";

const props = defineProps<{
  events: EventConfig[];
  activeEvent: EventConfig | null;
  isFetching: boolean;
  syncError: boolean;
  lastUpdated: Date | null;
  theme: "light" | "dark";
}>();

const emit = defineEmits<{
  (e: "selectEvent", eventId: string): void;
  (e: "refresh"): void;
  (e: "share"): void;
  (e: "toggleTheme"): void;
  (e: "reset"): void;
}>();

const isDropdownOpen = ref(false);
const eventBarRef = ref<HTMLElement | null>(null);

const syncText = computed(() => {
  if (props.isFetching) return "Syncing...";
  if (props.syncError) return "Sync error";
  if (props.lastUpdated) {
    return `Synced ${props.lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return "Live";
});

function selectEvent(id: string) {
  isDropdownOpen.value = false;
  emit("selectEvent", id);
}

function handleClickOutside(e: MouseEvent) {
  if (eventBarRef.value && !eventBarRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
