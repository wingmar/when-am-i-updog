<template>
  <div class="mobile-run-card" :class="{ 'has-conflict': Boolean(tightTurnaroundNotice) }">
    <!-- Card Top Bar: Big Block Time + Badges -->
    <div class="card-top-bar">
      <div class="block-time-group">
        <span class="block-time-val">{{ blockTime.start.formatted }}</span>
        <span class="block-time-period">{{ blockTime.start.period }}</span>
      </div>
      <div class="card-badges-right">
        <span class="ordinal-pill">#{{ run.ordinalInBlock }} of {{ run.totalInBlock }}</span>
        <span class="field-pill" :class="fieldClass">{{ run.field }}</span>
      </div>
    </div>

    <!-- Card Body: Game Title & Dog -->
    <div class="card-main-info">
      <h4 class="game-title">{{ run.game }}</h4>
      <div class="dog-specs-row">
        <span class="dog-badge">
          <span>🐾</span>
          <span>{{ run.dog || "Unassigned" }}</span>
        </span>
      </div>
    </div>

    <!-- Card Footer: Time Range & Turnaround Alert -->
    <div class="card-footer">
      <span class="block-range-text">
        🕒 {{ blockTime.range }} Block
      </span>
      <span v-if="tightTurnaroundNotice" class="conflict-tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        {{ tightTurnaroundNotice }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatBlockTimeWindow } from "../adapters/base";
import type { NormalizedRun } from "../types";

const props = defineProps<{
  run: NormalizedRun;
  tightTurnaroundNotice: string | null;
}>();

const blockTime = computed(() => formatBlockTimeWindow(props.run.blockTime));

const fieldClass = computed(() => {
  const f = props.run.field.toLowerCase();
  if (f.includes("2/3")) return "field-23";
  if (f.includes("3")) return "field-3";
  if (f.includes("2")) return "field-2";
  return "field-1";
});
</script>
