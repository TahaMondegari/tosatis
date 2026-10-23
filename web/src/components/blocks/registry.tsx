import type { ReactNode } from 'react';
import type { UIBlock } from '../../lib/types';
import { BudgetPicker, ChoiceForm, LocationRequest, PriorityRanker } from './inputs';
import { CompareTable, ProductCards, QuickReplies } from './products';
import { Alternatives, CheaperCheck, StoreBlock, StoreList, VisitPlan } from './stores';
import { ContactCard, NavigateBlock } from './contact';
import { AiCallCard } from './aiCall';

type Renderer = (p: { block: UIBlock; answer?: any; latest: boolean }) => ReactNode;

const REGISTRY: Record<string, Renderer> = {
  choice: (p) => <ChoiceForm block={p.block} answer={p.answer} />,
  budget: (p) => <BudgetPicker block={p.block} answer={p.answer} />,
  priority: (p) => <PriorityRanker block={p.block} answer={p.answer} />,
  location: (p) => <LocationRequest block={p.block} answer={p.answer} />,
  products: (p) => <ProductCards block={p.block} />,
  productCompare: (p) => <CompareTable block={p.block} />,
  storeCompare: (p) => <CompareTable block={p.block} />,
  stores: (p) => <StoreList block={p.block} />,
  store: (p) => <StoreBlock block={p.block} />,
  contact: (p) => <ContactCard block={p.block} answer={p.answer} />,
  navigate: (p) => <NavigateBlock block={p.block} />,
  cheaper: (p) => <CheaperCheck block={p.block} />,
  alternatives: (p) => <Alternatives block={p.block} />,
  plan: (p) => <VisitPlan block={p.block} />,
  aiCall: (p) => <AiCallCard block={p.block} answer={p.answer} />,
  quickReplies: (p) => <QuickReplies block={p.block} latest={p.latest} />,
};

/** The agent calls this (via SSE `ui` events) to render a component inside the chat. */
export function renderAgentComponent(block: UIBlock, answer: unknown, latest: boolean) {
  const r = REGISTRY[block.component];
  return r ? r({ block, answer, latest }) : null;
}
