import type { Avatar } from "../types";
import avatars from "$lib/avatars.json" assert { type: "json" };

export function getAllAvatars(): string[] {
  return (avatars as Avatar[]).map((a) => a.path);
}

export function getRandomAvatar(): string {
  return (avatars as Avatar[])[getRandomInt()].path;
}

function getRandomInt(): number {
  return Math.floor(Math.random() * avatars.length);
}