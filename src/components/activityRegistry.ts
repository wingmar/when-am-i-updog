import type { Component } from "vue";
import RunCard from "./RunCard.vue";
import VolunteerCard from "./VolunteerCard.vue";

export const activityCardMap: Record<string, Component> = {
  run: RunCard,
  volunteer: VolunteerCard
};
