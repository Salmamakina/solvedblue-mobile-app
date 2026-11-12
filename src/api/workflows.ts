/**
 * Mirrors spyder-web/src/api/workflows.ts.
 *
 * A workflow is the sequence of messages a campaign sends. The web builds it on
 * a canvas of nodes and edges; this app builds the same graph as a straight
 * list of steps (see src/utils/workflowSteps.ts), because a drag-and-drop
 * canvas is not usable on a phone. Both produce the definition the backend's
 * executeWorkflowDefinition walks, so a workflow made here opens in the web.
 */
import api from './client';

export type WorkflowStatus = 'active' | 'in_use' | 'draft' | 'published';

/**
 * `type` is the node's family and `nodeType` its specific kind. The engine
 * keys off both: a trigger is skipped, anything whose nodeType starts with
 * `send_` sends `config.message`, and a `timing`/`delay` node adds
 * `config.delay_value` of `config.delay_unit` to everything after it.
 */
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'timing' | 'filter';
  nodeType: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: 'yes' | 'no' | 'default';
  splitIndex?: number;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  definition?: WorkflowDefinition;
  created_at: string;
  updated_at?: string;
  status?: WorkflowStatus;
  campaign_ids?: { id: string; name: string; status: string }[];
}

export const WORKFLOWS_QUERY_KEY = 'workflows';

export const workflowsApi = {
  list: () =>
    api.get<{ workflows: Workflow[] }>('/workflows').then((res) => res.data.workflows),

  get: (id: string) =>
    api.get<{ workflow: Workflow }>(`/workflows/${id}`).then((res) => res.data.workflow),

  /** Both a name and a definition with at least one node are required. */
  create: (name: string, definition: WorkflowDefinition) =>
    api
      .post<{ workflow: Workflow }>('/workflows', { name, definition })
      .then((res) => res.data.workflow),

  /**
   * A published workflow is locked: the server refuses a name or definition
   * change until it is unpublished, so only the status may be sent.
   */
  update: (
    id: string,
    patch: { name?: string; definition?: WorkflowDefinition; status?: WorkflowStatus }
  ) =>
    api
      .put<{ workflow: Workflow }>(`/workflows/${id}`, patch)
      .then((res) => res.data.workflow),

  remove: (id: string) => api.delete(`/workflows/${id}`).then(() => undefined),
};
