import { agents } from "./agents";
import { brain } from "./brain";
import { ceo } from "./ceo";
import { content } from "./content";
import { design } from "./design";
import { marketing } from "./marketing";
import { shopify } from "./shopify";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { navigation } from "./navigation";
import { platform } from "./platform";
import { reports } from "./reports";
import { research } from "./research";
import { settings } from "./settings";
import { tasks } from "./tasks";

export const de = {
  common,
  navigation,
  platform,
  dashboard,
  agents,
  brain,
  tasks,
  reports,
  research,
  settings,
  ceo,
  content,
  design,
  marketing,
  shopify,
} as const;

export type DeDictionary = typeof de;
