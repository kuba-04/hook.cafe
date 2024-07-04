// List of avatars
import bear from "$lib/images/avatars/bear.png";
import bearTeddy from "$lib/images/avatars/bear-teddy.png";
import birdSing from "$lib/images/avatars/bird-sing.png";
import bird from "$lib/images/avatars/bird.png";
import bird2 from "$lib/images/avatars/bird2.png";
import cat from "$lib/images/avatars/cat.png";
import crab from "$lib/images/avatars/crab.png";
import crocodile from "$lib/images/avatars/crocodile.png";
import dino from "$lib/images/avatars/dino.png";
import dogBig from "$lib/images/avatars/dog-big.png";
import dogLittle from "$lib/images/avatars/dog-little.png";
import dog1 from "$lib/images/avatars/dog1.png";
import dolphinFun from "$lib/images/avatars/dolphin-fun.png";
import dolphin from "$lib/images/avatars/dolphin.png";
import elephant from "$lib/images/avatars/elephant.png";
import elephant2 from "$lib/images/avatars/elephant2.png";
import fishGold from "$lib/images/avatars/fish-gold.png";
import giraffe from "$lib/images/avatars/giraffe.png";
import lion from "$lib/images/avatars/lion.png";
import monkey from "$lib/images/avatars/monkey.png";
import mosquito from "$lib/images/avatars/mosquito.png";
import mouse from "$lib/images/avatars/mouse.png";
import panda from "$lib/images/avatars/panda.png";
import penguin from "$lib/images/avatars/penguin.png";
import tiger from "$lib/images/avatars/tiger.png";

export const avatars = [
  bear,
  bearTeddy,
  birdSing,
  bird,
  bird2,
  cat,
  crab,
  crocodile,
  dino,
  dogBig,
  dogLittle,
  dog1,
  dolphin,
  dolphinFun,
  elephant,
  elephant2,
  fishGold,
  giraffe,
  lion,
  monkey,
  mosquito,
  mouse,
  panda,
  penguin,
  tiger,
];

export function getRandomAvatar() {
    return avatars[getRandomInt()];
}

function getRandomInt() {
    return Math.floor(Math.random() * avatars.length);
}