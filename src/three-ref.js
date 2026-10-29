// Holds the THREE namespace once it has loaded from the CDN, so every module can use `T.Mesh` etc.
export const T = {};
export function setThree(ns) { Object.assign(T, ns); }
