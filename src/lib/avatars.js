import avatars from "$lib/avatars.json";

export function getAllAvatars() {
  return avatars.map(a => a.path);
}

export function getRandomAvatar() {
    return avatars[getRandomInt()].path;
}

function getRandomInt() {
    return Math.floor(Math.random() * avatars.length);
}