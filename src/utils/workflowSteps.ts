/**
 * A workflow as a straight list of steps, and the translation to and from the
 * node graph the backend executes.
 *
 * The web builds workflows on a canvas: nodes placed freely, edges drawn
 * between them, branches and splits. That does not work on a phone, so this app
 * offers the shape that covers the common case: send a message, wait, send
 * another. One path, no branches.
 *
 * The graph it emits is the same one the web's canvas emits, so a workflow
 * created on a phone opens and edits normally in the web builder. Going the
 * other way is lossy by nature: a branching workflow cannot be shown as a
 * list, so `stepsOf` reports when it will not fit and the caller sends the user
 * to the web rather than silently flattening it.
 */
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../api/workflows';

export type DelayUnit = 'minutes' | 'hours' | 'days';

export const DELAY_UNITS: { key: DelayUnit; label: string }[] = [
  { key: 'minutes', label: 'minutes' },
  { key: 'hours', label: 'hours' },
  { key: 'days', label: 'days' },
];

/** A message to send. `delivery_method: 'auto'` lets the backend route it. */
export interface MessageStep {
  kind: 'message';
  text: string;
}

/** A wait before whatever comes next. */
export interface WaitStep {
  kind: 'wait';
  value: number;
  unit: DelayUnit;
}

export type WorkflowStep = MessageStep | WaitStep;

/** The trigger every definition needs; the engine looks for it by nodeType. */
const START_NODE_ID = 'start';

/**
 * Steps as the node graph the backend walks.
 *
 * Node ids are stable and derived from the index, so saving the same list twice
 * produces the same graph. Positions are included because the web canvas reads
 * them; laid out in a column so an imported workflow is readable there.
 */
export function definitionOf(steps: WorkflowStep[]): WorkflowDefinition {
  const nodes: WorkflowNode[] = [
    {
      id: START_NODE_ID,
      type: 'trigger',
      nodeType: 'campaign_start',
      config: {},
      position: { x: 0, y: 0 },
    },
  ];
  const edges: WorkflowEdge[] = [];

  let previousId = START_NODE_ID;

  steps.forEach((step, index) => {
    const id = `step-${index + 1}`;
    const position = { x: 0, y: (index + 1) * 140 };

    if (step.kind === 'message') {
      nodes.push({
        id,
        type: 'action',
        nodeType: 'send_message',
        // 'auto' lets the backend pick iMessage or SMS per contact, which is
        // what the product does by default.
        config: { message: step.text, delivery_method: 'auto' },
        position,
      });
    } else {
      nodes.push({
        id,
        type: 'timing',
        nodeType: 'delay',
        config: { delay_type: 'duration', delay_value: step.value, delay_unit: step.unit },
        position,
      });
    }

    edges.push({ id: `edge-${previousId}-${id}`, source: previousId, target: id });
    previousId = id;
  });

  return { nodes, edges };
}

export type StepsResult =
  | { fits: true; steps: WorkflowStep[] }
  /** Why the workflow cannot be shown as a list. */
  | { fits: false; reason: string };

/**
 * A definition back as steps, when it is a single unbranched path.
 *
 * Anything else (a node with two outgoing edges, a filter, a split, a node type
 * this app cannot render) is reported rather than approximated.
 */
export function stepsOf(definition: WorkflowDefinition | undefined): StepsResult {
  if (!definition || !Array.isArray(definition.nodes) || definition.nodes.length === 0) {
    return { fits: true, steps: [] };
  }

  const { nodes, edges = [] } = definition;
  const start = nodes.find((node) => node.type === 'trigger');
  if (!start) {
    return { fits: false, reason: 'This workflow has no start step.' };
  }

  const steps: WorkflowStep[] = [];
  const seen = new Set<string>([start.id]);
  let current = start;

  for (;;) {
    const outgoing = edges.filter((edge) => edge.source === current.id);
    if (outgoing.length === 0) break;
    if (outgoing.length > 1) {
      return { fits: false, reason: 'This workflow branches, so it can only be edited on the web.' };
    }

    const nextId = outgoing[0].target;
    if (seen.has(nextId)) {
      return { fits: false, reason: 'This workflow loops back on itself.' };
    }
    seen.add(nextId);

    const next = nodes.find((node) => node.id === nextId);
    if (!next) {
      return { fits: false, reason: 'This workflow points at a step that is missing.' };
    }

    if (next.nodeType === 'delay') {
      const value = Number(next.config.delay_value ?? 1);
      const unit = next.config.delay_unit;
      steps.push({
        kind: 'wait',
        value: Number.isFinite(value) && value > 0 ? value : 1,
        unit: unit === 'hours' || unit === 'days' ? unit : 'minutes',
      });
    } else if (String(next.nodeType).startsWith('send_')) {
      steps.push({ kind: 'message', text: String(next.config.message ?? '') });
    } else {
      return {
        fits: false,
        reason: `This workflow uses a step this app cannot show yet (${next.nodeType}).`,
      };
    }

    current = next;
  }

  return { fits: true, steps };
}

/** What is wrong with the list, or null when it is ready to save. */
export function validateSteps(steps: WorkflowStep[]): string | null {
  const messages = steps.filter((step) => step.kind === 'message');
  if (messages.length === 0) {
    return 'Add at least one message.';
  }
  if (messages.some((step) => (step as MessageStep).text.trim() === '')) {
    return 'Every message needs some text.';
  }
  // A trailing wait delays nothing, and a leading one holds up the first send
  // for no reason the user can see on the list.
  if (steps.length > 0 && steps[steps.length - 1].kind === 'wait') {
    return 'The last step is a wait, so nothing follows it. Remove it or add a message.';
  }
  return null;
}

/** "2 messages · waits 1 day", for a workflow row. */
export function describeSteps(steps: WorkflowStep[]): string {
  const messages = steps.filter((step) => step.kind === 'message').length;
  const waits = steps.filter((step) => step.kind === 'wait') as WaitStep[];
  const parts = [`${messages} ${messages === 1 ? 'message' : 'messages'}`];

  if (waits.length === 1) {
    parts.push(`waits ${waits[0].value} ${singular(waits[0].value, waits[0].unit)}`);
  } else if (waits.length > 1) {
    parts.push(`${waits.length} waits`);
  }
  return parts.join(' · ');
}

/** "1 day" rather than "1 days". */
export function singular(value: number, unit: DelayUnit): string {
  return value === 1 ? unit.slice(0, -1) : unit;
}
