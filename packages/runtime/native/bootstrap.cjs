"use strict";

// Node evaluates this preload before the unchanged public ttsc/ttsx launcher.
const { prepareNativeEnvironment } = require("./prepareNativeEnvironment.cjs");
const prepared = prepareNativeEnvironment(process.env);
Object.assign(process.env, prepared.environment);
