import { agents } from "./agents";
import { brain } from "./brain";
import { ceo } from "./ceo";
import { content } from "./content";
import { facility } from "./facility";
import { intelligence } from "./intelligence";
import { hqNavigation } from "./hq-navigation";
import { image } from "./image";
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
  hqNavigation,
  platform,
  dashboard,
  agents,
  brain,
  tasks,
  reports,
  research,
  settings,
  facility,
  intelligence,
  ceo,
  content,
  image,
  design,
  marketing,
  shopify,
} as const;

export type DeDictionary = typeof de;
