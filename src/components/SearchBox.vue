<template>
  <div class="search-section" ref="searchSectionRef">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder="Search handler or dog name..."
        autocomplete="off"
        spellcheck="false"
        :value="modelValue"
        @input="onInput"
        @focus="onFocus"
      />
      <button
        v-if="modelValue"
        class="search-clear"
        style="display: grid"
        title="Clear search"
        @click="emit('clear')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <ul class="suggestions-list" :style="{ display: showSuggestions ? 'block' : 'none' }">
      <li
        v-for="item in suggestions"
        :key="item.name"
        class="suggestion-item"
        @click="selectSuggestion(item.name)"
      >
        <div>
          <div class="suggestion-name">{{ item.name }}</div>
          <div class="suggestion-meta">
            <span v-if="item.matchedDog">Matches dog: 🐾 <strong>{{ item.matchedDog }}</strong> &bull; </span>
            {{ item.dogs.join(", ") }}
            <span v-if="item.hasVolunteer"> &bull; 📋 Volunteer</span>
          </div>
        </div>
        <span class="suggestion-meta">{{ item.itemsCount }} entries</span>
      </li>
      <li v-if="suggestions.length === 0" class="suggestion-item">
        <span class="suggestion-meta">No matching handlers or dogs</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ScheduleItem } from "../types";

const props = defineProps<{
  modelValue: string;
  allHandlers: { name: string; dogs: Set<string>; items: ScheduleItem[] }[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: string): void;
  (e: "select", name: string): void;
  (e: "clear"): void;
}>();

const query = ref("");
const showSuggestions = ref(false);
const searchSectionRef = ref<HTMLElement | null>(null);

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return props.allHandlers.slice(0, 10).map((h) => ({
      name: h.name,
      itemsCount: h.items.length,
      dogs: Array.from(h.dogs),
      matchedDog: null,
      hasVolunteer: h.items.some((i) => i.activity.kind === "volunteer")
    }));
  }

  const matches: {
    name: string;
    itemsCount: number;
    dogs: string[];
    matchedDog: string | null;
    hasVolunteer: boolean;
  }[] = [];

  for (const h of props.allHandlers) {
    const handlerMatch = h.name.toLowerCase().includes(q);
    const matchingDogs = Array.from(h.dogs).filter((d) => d.toLowerCase().includes(q));
    if (handlerMatch || matchingDogs.length > 0) {
      matches.push({
        name: h.name,
        itemsCount: h.items.length,
        dogs: Array.from(h.dogs),
        matchedDog: !handlerMatch && matchingDogs.length > 0 ? matchingDogs[0] : null,
        hasVolunteer: h.items.some((i) => i.activity.kind === "volunteer")
      });
    }
  }
  return matches.slice(0, 15);
});

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  query.value = val;
  emit("update:modelValue", val);
  showSuggestions.value = true;
}

function onFocus() {
  showSuggestions.value = true;
}

function selectSuggestion(name: string) {
  showSuggestions.value = false;
  query.value = name;
  emit("select", name);
}

function handleClickOutside(e: MouseEvent) {
  if (searchSectionRef.value && !searchSectionRef.value.contains(e.target as Node)) {
    showSuggestions.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
