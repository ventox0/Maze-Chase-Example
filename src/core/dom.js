export const $ = (id) => document.getElementById(id);

export const canvas = $("game"),
  ctx = canvas.getContext("2d");

export const motionPreference = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;

export const loadoutDialog = $("loadout-dialog");
