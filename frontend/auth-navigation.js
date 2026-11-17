"use strict";
function orderDestination(search) {
  const values = new URLSearchParams(search).getAll("next");
  if (values.length !== 1 || !/^commande\.html\?menu=[1-9]\d*(?:&order=[1-9]\d*)?$/.test(values[0])) return null;
  const params = new URLSearchParams(values[0].split("?")[1]);
  return [...params.values()].every((value) => Number.isSafeInteger(Number(value))) ? values[0] : null;
}
if (typeof module !== "undefined") module.exports = { orderDestination };
