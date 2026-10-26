<template>
  <div class="profile-card">
    <div class="profile-header">
      <div>
        <h2 class="profile-title">{{ handlerData.name }}</h2>
        <div class="profile-stats">
          <span class="stat-chip">{{ totalRunsCount }} Competition {{ totalRunsCount === 1 ? "Run" : "Runs" }}</span>
          <span v-if="volunteerShiftsCount > 0" class="stat-chip">📋 {{ volunteerShiftsCount }} Volunteer {{ volunteerShiftsCount === 1 ? "Shift" : "Shifts" }}</span>
          <span v-if="dogs.length > 0" class="stat-chip">{{ dogs.length }} {{ dogs.length === 1 ? "Dog" : "Dogs" }}</span>
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
            <span class="filter-count">{{ totalItemsForDayFilter }}</span>
          </button>
          <button
            v-for="d in activeDays"
            :key="d"
            class="filter-btn"
            :class="{ active: selectedDay === d }"
            @click="emit('update:selectedDay', d)"
          >
            <span>{{ d }}</span>
            <span class="filter-count">{{ countItemsByDay(d) }}</span>
          </button>
        </div>
      </div>

      <!-- Dog & Volunteer Filters Strip -->
      <div v-if="dogs.length > 1 || volunteerShiftsCount > 0" class="filter-group">
        <span class="filter-label">Filter</span>
        <div class="filter-strip">
          <button
            class="filter-btn"
            :class="{ active: selectedDog === null && !selectedVolunteerOnly }"
            @click="clearActivityFilter"
          >
            <span>All Entries</span>
          </button>
          <button
            v-for="dog in dogs"
            :key="dog"
            class="filter-btn"
            :class="{ active: selectedDog === dog && !selectedVolunteerOnly }"
            @click="selectDogFilter(dog)"
          >
            <span>🐾 {{ dog }}</span>
            <span class="filter-count">{{ countRunsByDog(dog) }}</span>
          </button>
          <button
            v-if="volunteerShiftsCount > 0"
            class="filter-btn"
            :class="{ active: selectedVolunteerOnly }"
            @click="selectVolunteerFilter"
          >
            <span>📋 Volunteer Shifts</span>
            <span class="filter-count">{{ volunteerShiftsCount }}</span>
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
import type { ScheduleItem } from "../types";

const props = defineProps<{
  handlerData: { name: string; dogs: Set<string>; items: ScheduleItem[] };
  daysOrder: string[];
  selectedDay: string;
  selectedDog: string | null;
  selectedVolunteerOnly: boolean;
  selectedField: string;
}>();

const emit = defineEmits<{
  (e: "update:selectedDay", val: string): void;
  (e: "update:selectedDog", val: string | null): void;
  (e: "update:selectedVolunteerOnly", val: boolean): void;
  (e: "update:selectedField", val: string): void;
}>();

const dogs = computed(() => Array.from(props.handlerData.dogs).sort());
const activeDays = computed(() =>
  props.daysOrder.filter((d) => props.handlerData.items.some((item) => item.day === d))
);
const activeFields = computed(() =>
  Array.from(new Set(props.handlerData.items.map((item) => item.field))).sort()
);

const totalRunsCount = computed(
  () => props.handlerData.items.filter((item) => item.activity.kind === "run").length
);

const volunteerShiftsCount = computed(
  () => props.handlerData.items.filter((item) => item.activity.kind === "volunteer").length
);

const totalItemsForDayFilter = computed(() => {
  if (props.selectedVolunteerOnly) {
    return volunteerShiftsCount.value;
  }
  if (props.selectedDog) {
    return props.handlerData.items.filter(
      (item) => item.activity.kind === "run" && item.activity.run.dog === props.selectedDog
    ).length;
  }
  return props.handlerData.items.length;
});

function countItemsByDay(day: string): number {
  return props.handlerData.items.filter((item) => {
    if (item.day !== day) return false;
    if (props.selectedVolunteerOnly) return item.activity.kind === "volunteer";
    if (props.selectedDog) return item.activity.kind === "run" && item.activity.run.dog === props.selectedDog;
    return true;
  }).length;
}

function countRunsByDog(dog: string): number {
  return props.handlerData.items.filter(
    (item) =>
      item.activity.kind === "run" &&
      item.activity.run.dog === dog &&
      (props.selectedDay === "all" || item.day === props.selectedDay)
  ).length;
}

function clearActivityFilter() {
  emit("update:selectedDog", null);
  emit("update:selectedVolunteerOnly", false);
}

function selectDogFilter(dog: string) {
  emit("update:selectedDog", dog);
  emit("update:selectedVolunteerOnly", false);
}

function selectVolunteerFilter() {
  emit("update:selectedDog", null);
  emit("update:selectedVolunteerOnly", true);
}
</script>
