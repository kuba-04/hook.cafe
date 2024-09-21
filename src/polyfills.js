let BigInt;
if (typeof window.BigInt === "undefined") {
  BigInt = require("big-integer");
} else {
  BigInt = window.BigInt; 
}
