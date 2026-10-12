import { profileStorage } from "../account/ProfileStorage.js";
import { AccountUI } from "../account/AccountUI.js";
import { LanUI } from "./LanUI.js";
await profileStorage.initialize();
new AccountUI();
new LanUI();
