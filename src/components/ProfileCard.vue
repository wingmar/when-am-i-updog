<template>
  <div class="profile-card">
    <div class="profile-header">
      <div>
        <h2 class="profile-title">{{ handlerData.name }}</h2>
        <div class="profile-stats">
          <span class="stat-chip">{{ handlerData.runs.length }} Total Runs</span>
          <span class="stat-chip">{{ dogs.length }} {{ dogs.length === 1 ? "Dog" : "Dogs" }}</span>
          <span class="stat-chip">{{ activeDays.length }} Competition {{ activeDays.length === 1 ? "Day" : "Days" }}</span>
        </div>
      </div>
    </div>

    <div class="filter-section">
      <!-- Day Filters Strip -->
      <div class="filter-group">
        <span class="filter-label">Day</span>
        <div class="filter-strip">
          <button
            class="filter-btn"
            :class="{ active: selectedDay === 'all' }"
            @click="emit('update:selectedDay', 'all')"
          >
            <span>All Days</span>
            <span class="filter-count">{{ totalRunsForDayFilter }}</span>
          </button>
          <button
            v-for="d in activeDays"
            :key="d"
            class="filter-btn"
            :class="{ active: selectedDay === d }"
            @click="emit('update:selectedDay', d)"
          >
            <span>{{ d }}</span>
            <span class="filter-count">{{ countRunsByDay(d) }}</span>
          </button>
        </div>
      </div>

      <!-- Dog Filters Strip -->
      <div v-if="dogs.length > 1" class="filter-group">
        <span class="filter-label">Dog</span>
        <div class="filter-strip">
          <button
            class="filter-btn"
            :class="{ active: selectedDog === null }"
            @click="emit('update:selectedDog', null)"
          >
            <span>All Dogs</span>
          </button>
          <button
            v-for="dog in dogs"
            :key="dog"
            class="filter-btn"
            :class="{ active: selectedDog === dog }"
            @click="emit('update:selectedDog', dog)"
          >
            <span>🐾 {{ dog }}</span>
            <span class="filter-count">{{ countRunsByDog(dog) }}</span>
          </button>
        </div>
      </div>

      <!-- Field Filters Strip -->
      <div v-if="activeFields.length > 1" class="filter-group">
        <span class="filter-label">Field</span>
        <div class="filter-strip">
          <button
            class="filter-btn"
            :class="{ active: selectedField === 'all' }"
            @click="emit('update:selectedField', 'all')"
          >
            <span>All Fields</span>
          </button>
          <button
            v-for="f in activeFields"
            :key="f"
            class="filter-btn"
            :class="{ active: selectedField === f }"
            @click="emit('update:selectedField', f)"
          >
            <span>{{ f }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { NormalizedRun } from "../types";

const props = defineProps<{
  handlerData: { name: string; dogs: Set<string>; runs: NormalizedRun[] };
  daysOrder: string[];
  selectedDay: string;
  selectedDog: string | null;
  selectedField: string;
}>();

const emit = defineEmits<{
  (e: "update:selectedDay", val: string): void;
  (e: "update:selectedDog", val: string | null): void;
  (e: "update:selectedField", val: string): void;
}>();

const dogs = computed(() => Array.from(props.handlerData.dogs).sort());
const activeDays = computed(() =>
  props.daysOrder.filter((d) => props.handlerData.runs.some((r) => r.day === d))
);
const activeFields = computed(() =>
  Array.from(new Set(props.handlerData.runs.map((r) => r.field))).sort()
);

const totalRunsForDayFilter = computed(() => {
  if (props.selectedDog) {
    return props.handlerData.runs.filter((r) => r.dog === props.selectedDog).length;
  }
  return props.handlerData.runs.length;
});

function countRunsByDay(day: string): number {
  return props.handlerData.runs.filter(
    (r) => r.day === day && (!props.selectedDog || r.dog === props.selectedDog)
  ).length;
}

function countRunsByDog(dog: string): number {
  return props.handlerData.runs.filter(
    (r) => r.dog === dog && (props.selectedDay === "all" || r.day === props.selectedDay)
  ).length;
}
</script>
