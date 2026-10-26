<template>
  <div class="mobile-run-card volunteer-card" :class="{ 'has-conflict': Boolean(conflictNotice) }">
    <div class="card-top-bar">
      <div class="block-time-group">
        <span class="block-time-val">{{ item.blockTime }}</span>
      </div>
      <div class="card-badges-right">
        <span class="volunteer-pill">📋 {{ shift.role }}</span>
        <span class="field-pill field-1">{{ item.field }}</span>
      </div>
    </div>

    <div class="card-main-info">
      <h4 class="game-title">{{ shift.role }} &bull; {{ item.game }}</h4>
      <div class="volunteer-desc">
        <span>Volunteer Duty &bull; Ready at field</span>
      </div>
    </div>

    <div class="card-footer">
      <span class="block-range-text">
        🕒 {{ shift.timeWindow }} Shift
      </span>
      <span v-if="conflictNotice" class="conflict-tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        {{ conflictNotice }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ScheduleItem, VolunteerShift } from "../types";

const props = defineProps<{
  item: ScheduleItem;
  conflictNotice?: string | null;
}>();

const shift = computed(() => {
  if (props.item.activity.kind === "volunteer") {
    return props.item.activity.shift;
  }
  return { role: "Volunteer", timeWindow: props.item.blockTime } as VolunteerShift;
});
</script>

<style scoped>
.volunteer-card {
  border-left: 4px solid var(--updog-orange);
}

.volunteer-pill {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-full);
  background: var(--field23-bg);
  border: 1.5px solid var(--field23-border);
  color: var(--field23-text);
  white-space: nowrap;
}

.volunteer-desc {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
